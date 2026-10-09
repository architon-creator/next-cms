"""Case matrix for POST / PUT / GET /demo/products (images + PDF).

Runs 32 cases against a running API (the Java API in apps/java-api or the Express
API in apps/api, both expose the same endpoints) and checks, for every case:
the response, which files are served or deleted, that no file is left behind or
removed by a rejected request, and that GET returns what was saved.

Usage (Python 3 and curl on PATH):

    python apps/api/docs/product-demo-cases.py <base-url> <uploads-dir>

    # Java API (default port 4001) - uploads live in apps/java-api/uploads
    python apps/api/docs/product-demo-cases.py http://localhost:4001 apps/java-api/uploads
    # Express API (default port 4000) - uploads live in apps/api/uploads
    python apps/api/docs/product-demo-cases.py http://localhost:4000 apps/api/uploads

<uploads-dir> is the folder the server writes uploaded files to; it is only
read, to count files before and after each request.

WARNING: this creates products and files on the server it targets. Point it at
a scratch instance, for example the Java API with its own database and upload
folder:

    java -jar apps/java-api/target/java-api-0.1.0.jar --server.port=4051       --spring.datasource.url=jdbc:h2:file:/tmp/casesdb/db/productdb       --app.upload-dir=/tmp/casesdb/uploads

Exit code is 0 when every case passes, 1 otherwise.
"""
import json, os, subprocess, sys, tempfile, urllib.request, urllib.error

if len(sys.argv) != 3:
    sys.exit(__doc__)

BASE, UPLOADS = sys.argv[1].rstrip("/"), sys.argv[2]
API = BASE + "/demo/products"
TMP = tempfile.mkdtemp()
results = []


# ------------------------------------------------------------------ helpers
def blob(name, size=40):
    path = os.path.join(TMP, name)
    if not os.path.exists(path):
        open(path, "wb").write(b"\xff\xd8\xff\xe0" + name.encode() + b"-" * size)
    return name


def curl(method, url, payload, parts):
    cmd = ["curl", "-s", "-X", method, url, "-F", "payload=" + json.dumps(payload)]
    for field, local, fname, mime in parts:
        cmd += ["-F", f"{field}=@{os.path.join(TMP, local)};type={mime};filename={fname}"]
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {"success": False, "error": "non-JSON response: " + out[:120]}


def http(url):
    try:
        with urllib.request.urlopen(url) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""


def served(url):
    return http(url)[0] == 200


def gone(url):
    return http(url)[0] == 404


def nfiles():
    return len(os.listdir(UPLOADS)) if os.path.isdir(UPLOADS) else 0


def body(images, pdf=None, price=1):
    p = {"category": "SampleCategory", "product": {"ssrCode": "SAMPLE", "price": price, "productImage": images}}
    if pdf is not None:
        p["product"]["productPdf"] = pdf
    return p


def img_part(fid, local, mime="image/jpeg"):
    return ("productImage", blob(local) if mime.startswith("image") else local, fid, mime)


def create(n_images, with_pdf=False, tag="x"):
    """Create a product with n images (distinct bytes each) and optionally a PDF."""
    items, parts = [], []
    for i in range(n_images):
        fid = f"product-image-{i + 1}"
        items.append({"image": fid, "description": f"{tag} desc {i + 1}"})
        parts.append(img_part(fid, f"{tag}-img{i + 1}.jpg"))
    pdf = None
    if with_pdf:
        open(os.path.join(TMP, f"{tag}.pdf"), "wb").write(b"%PDF-1.4 " + tag.encode())
        pdf = "product-pdf"
        parts.append(("productPdf", f"{tag}.pdf", pdf, "application/pdf"))
    r = curl("POST", API, body(items, pdf), parts)
    assert r.get("success"), r
    d = r["data"]["product"]
    return {"id": r["id"], "images": d["productImage"], "pdf": d.get("productPdf"), "data": r["data"]}


def state(pid):
    return json.loads(http(f"{API}/{pid}")[1])["data"]


class Case:
    """Collects check results for one case."""

    def __init__(self, name):
        self.name, self.problems = name, []

    def ok(self, cond, what, detail=""):
        if not cond:
            self.problems.append(what + (f" -> {detail}" if detail else ""))

    def done(self):
        results.append((self.name, not self.problems, self.problems))


def run_update(name, product, items, parts, pdf=None, expect_ok=True, kept=(), removed=(), new_files=0,
               pdf_new=False, pdf_removed=False, keep_pdf_served=False):
    """Run one update and verify response, served/deleted files, orphans and persistence."""
    c = Case(name)
    before_state, before_files = state(product["id"]), nfiles()
    old_urls = [i["image"] for i in product["images"]]
    r = curl("PUT", f"{API}/{product['id']}", body(items, pdf), parts)
    if not expect_ok:
        c.ok(r.get("success") is False, "should be rejected (400)", r)
        c.ok(state(product["id"]) == before_state, "stored product must be unchanged")
        c.ok(nfiles() == before_files, "no files may be added or deleted", f"{before_files} -> {nfiles()}")
        c.ok(all(served(u) for u in old_urls), "old images must still be served")
        if product.get("pdf"):
            c.ok(served(product["pdf"]), "old pdf must still be served")
        c.done()
        return r
    c.ok(r.get("success") and r.get("id") == product["id"], "update should succeed with same id", r)
    if not r.get("success"):
        c.done()
        return r
    imgs = r["data"]["product"]["productImage"]
    c.ok(len(imgs) == len(items), f"expected {len(items)} images", len(imgs))
    kept_urls = [old_urls[i] for i in kept]
    for u in kept_urls:
        c.ok(u in [i["image"] for i in imgs], "kept image url must be unchanged", u)
        c.ok(served(u), "kept image must still be served")
    for i in removed:
        c.ok(gone(old_urls[i]), f"removed image #{i + 1} must be deleted from disk")
    new_urls = [i["image"] for i in imgs if i["image"] not in old_urls]
    c.ok(len(new_urls) == new_files, f"expected {new_files} new image urls", new_urls)
    c.ok(all(served(u) for u in new_urls), "new images must be served")
    c.ok(len(set(i["image"] for i in imgs)) == len(imgs), "every image url must be distinct")
    new_pdf = r["data"]["product"].get("productPdf")
    if pdf_new:
        c.ok(new_pdf and new_pdf != product.get("pdf") and served(new_pdf), "new pdf stored and served", new_pdf)
    if pdf_removed:
        c.ok(new_pdf is None, "response must have no productPdf", new_pdf)
    if product.get("pdf") and (pdf_new or pdf_removed):
        c.ok(gone(product["pdf"]), "old pdf must be deleted from disk")
    if keep_pdf_served:
        c.ok(new_pdf == product["pdf"] and served(new_pdf), "pdf must be kept and served", new_pdf)
    delta = (new_files + (1 if pdf_new else 0)) - (len(removed) + (1 if (pdf_new or pdf_removed) and product.get("pdf") else 0))
    c.ok(nfiles() - before_files == delta, f"files on disk should change by {delta}", nfiles() - before_files)
    c.ok(state(product["id"]) == r["data"], "GET must return what the update returned (persisted)")
    c.done()
    return r


def keep(product, i, description=None):
    it = {"image": product["images"][i]["image"]}
    it["description"] = product["images"][i].get("description", "") if description is None else description
    return it


def new_item(pos, description="new"):
    return {"image": f"product-image-{pos}", "description": description}


# -------------------------------------------------------------------- cases
# ---- A. the cases from the request
p = create(1, tag="A1")
run_update("A1 add 2 new images (keep the existing one)", p,
           [keep(p, 0), new_item(2), new_item(3)],
           [img_part("product-image-2", "A1-n2.jpg"), img_part("product-image-3", "A1-n3.jpg")],
           kept=[0], new_files=2)

p = create(2, tag="A2")
run_update("A2 replace 1 image (new file) + add 1 new image", p,
           [new_item(1, "replaced"), keep(p, 1), new_item(3, "added")],
           [img_part("product-image-1", "A2-r1.jpg"), img_part("product-image-3", "A2-n3.jpg")],
           kept=[1], removed=[0], new_files=2)

p = create(2, tag="A3")
run_update("A3 remove 1 image + add 1 new image", p,
           [keep(p, 1), new_item(2, "added")],
           [img_part("product-image-2", "A3-n2.jpg")],
           kept=[1], removed=[0], new_files=1)

p = create(2, tag="A4")
run_update("A4 remove ALL existing images + add 1 new image", p,
           [new_item(1, "only one")],
           [img_part("product-image-1", "A4-n1.jpg")],
           removed=[0, 1], new_files=1)

# ---- B. other image cases
p = create(2, tag="B1")
run_update("B1 edit descriptions only (no files at all)", p,
           [keep(p, 0, "edited 1"), keep(p, 1, "edited 2")], [], kept=[0, 1])

p = create(3, tag="B2")
run_update("B2 reorder only", p, [keep(p, 2), keep(p, 0), keep(p, 1)], [], kept=[0, 1, 2])

p = create(3, tag="B3")
run_update("B3 remove 1 image, add nothing", p, [keep(p, 0), keep(p, 2)], [], kept=[0, 2], removed=[1])

p = create(2, tag="B4")
run_update("B4 replace EVERY image with new files (same count)", p,
           [new_item(1, "n1"), new_item(2, "n2")],
           [img_part("product-image-1", "B4-n1.jpg"), img_part("product-image-2", "B4-n2.jpg")],
           removed=[0, 1], new_files=2)

p = create(1, tag="B5")
run_update("B5 same picture added twice as two new items", p,
           [keep(p, 0), new_item(2, "dup a"), new_item(3, "dup b")],
           [img_part("product-image-2", "B5-same.jpg"), img_part("product-image-3", "B5-same.jpg")],
           kept=[0], new_files=2)

p = create(1, tag="B6")
run_update("B6 grow to the 10-image limit (1 existing + 9 new)", p,
           [keep(p, 0)] + [new_item(i) for i in range(2, 11)],
           [img_part(f"product-image-{i}", f"B6-n{i}.jpg") for i in range(2, 11)],
           kept=[0], new_files=9)

p = create(2, tag="B7")
run_update("B7 no-op update (resend everything as is)", p, [keep(p, 0), keep(p, 1)], [], kept=[0, 1])

p = create(1, tag="B8")
run_update("B8 clear a description (empty string)", p, [keep(p, 0, "")], [], kept=[0])

p = create(2, tag="B9")
run_update("B9 move: remove #1, new image goes FIRST", p,
           [new_item(1, "first now"), keep(p, 1)],
           [img_part("product-image-1", "B9-n1.jpg")], kept=[1], removed=[0], new_files=1)

# ---- C. update must be rejected and change nothing
p = create(2, tag="C1")
run_update("C1 remove all images, add none -> 400", p, [], [], expect_ok=False)

p = create(1, tag="C2")
run_update("C2 11 images (over the limit) -> 400", p,
           [keep(p, 0)] + [new_item(i) for i in range(2, 12)],
           [img_part(f"product-image-{i}", f"C2-n{i}.jpg") for i in range(2, 12)], expect_ok=False)

p = create(1, tag="C3")
run_update("C3 new image id without a file -> 400", p, [keep(p, 0), new_item(2)], [], expect_ok=False)

p = create(1, tag="C4")
run_update("C4 uploaded file not listed in payload -> 400", p, [keep(p, 0)],
           [img_part("product-image-9", "C4-x.jpg")], expect_ok=False)

p = create(1, tag="C5")
open(os.path.join(TMP, "note.txt"), "w").write("not an image")
run_update("C5 non-image file as an image -> 400", p, [keep(p, 0), new_item(2)],
           [("productImage", "note.txt", "product-image-2", "text/plain")], expect_ok=False)

p = create(1, tag="C6")
open(os.path.join(TMP, "big.jpg"), "wb").write(b"\xff\xd8\xff\xe0" + b"0" * (6 * 1024 * 1024))
run_update("C6 image over 5 MB -> 400", p, [keep(p, 0), new_item(2)],
           [("productImage", "big.jpg", "product-image-2", "image/jpeg")], expect_ok=False)

p, q = create(1, tag="C7p"), create(1, tag="C7q")
run_update("C7 keep an image URL that belongs to ANOTHER product -> 400", p,
           [keep(p, 0), {"image": q["images"][0]["image"], "description": "stolen"}], [], expect_ok=False)

p = create(2, tag="C8")
stale = p["images"][0]["image"]
run_update("C8 (setup) remove image #1 in one tab", p, [keep(p, 1)], [], kept=[1], removed=[0])
p2 = {"id": p["id"], "images": [p["images"][1]], "pdf": None}
run_update("C8 stale form: keep an image that was already removed -> 400", p2,
           [{"image": stale, "description": "old"}, keep(p2, 0)], [], expect_ok=False)

p = create(1, tag="C9")
run_update("C9 same image kept twice -> 400", p, [keep(p, 0), keep(p, 0)], [], expect_ok=False)

p = create(1, tag="C10")
run_update("C10 unsafe new id (../x) -> 400", p, [keep(p, 0), {"image": "../x", "description": ""}],
           [("productImage", blob("C10-x.jpg"), "../x", "image/jpeg")], expect_ok=False)

# ---- D. PDF cases
p = create(1, tag="D1")
open(os.path.join(TMP, "D1.pdf"), "wb").write(b"%PDF-1.4 d1")
run_update("D1 add a PDF to a product that has none", p, [keep(p, 0)],
           [("productPdf", "D1.pdf", "product-pdf", "application/pdf")], pdf="product-pdf", kept=[0], pdf_new=True)

p = create(1, with_pdf=True, tag="D2")
open(os.path.join(TMP, "D2b.pdf"), "wb").write(b"%PDF-1.4 second")
run_update("D2 replace the PDF", p, [keep(p, 0)],
           [("productPdf", "D2b.pdf", "product-pdf", "application/pdf")], pdf="product-pdf", kept=[0], pdf_new=True)

p = create(1, with_pdf=True, tag="D3")
run_update("D3 remove the PDF (leave it out)", p, [keep(p, 0)], [], pdf=None, kept=[0], pdf_removed=True)

p = create(2, with_pdf=True, tag="D4")
run_update("D4 keep the PDF while changing images", p,
           [keep(p, 1), new_item(2)], [img_part("product-image-2", "D4-n2.jpg")],
           pdf=p["pdf"], kept=[1], removed=[0], new_files=1, keep_pdf_served=True)

p = create(2, with_pdf=True, tag="D5")
run_update("D5 remove the PDF AND replace all images", p, [new_item(1)],
           [img_part("product-image-1", "D5-n1.jpg")], pdf=None, removed=[0, 1], new_files=1, pdf_removed=True)

p = create(1, with_pdf=True, tag="D6")
run_update("D6 PDF id given but no PDF file -> 400", p, [keep(p, 0)], [], pdf="product-pdf", expect_ok=False)

p = create(1, tag="D7")
run_update("D7 image sent as the PDF -> 400", p, [keep(p, 0)],
           [("productPdf", blob("D7.jpg"), "product-pdf", "image/jpeg")], pdf="product-pdf", expect_ok=False)

# ---- E. misc
c = Case("E1 update an unknown product id -> 404")
r = curl("PUT", f"{API}/does-not-exist", body([{"image": "product-image-1"}]), [img_part("product-image-1", "E1.jpg")])
c.ok(r.get("success") is False and "not found" in r.get("error", "").lower(), "expected 404 body", r)
c.done()

# ------------------------------------------------------------------- report
width = max(len(n) for n, _, _ in results)
for name, ok, problems in results:
    print(("PASS  " if ok else "FAIL  ") + name)
    for pr in problems:
        print("        - " + pr)
failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} cases passed")
sys.exit(1 if failed else 0)
