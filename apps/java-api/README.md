# java-api

Spring Boot (Java 17) implementation of the product-demo endpoints that
also exist in `apps/api` (Express):

- `POST /demo/products` — create (returns the new product `id`)
- `GET /demo/products/{id}` — read
- `PUT /demo/products/{id}` — update: keep, add or remove images per item, keep/replace/remove the PDF

Products and their images are stored in an H2 file database (see Database below),
so they survive restarts.

It takes a `multipart/form-data` request with

- `payload` — a JSON text part (`{ category, product: { ssrCode, price, productImage: [{ image, description }], ... } }`)
- `productImage` — one file part per image, whose **filename is the image id** used in `payload.product.productImage[].image`

and returns the same payload with each image id replaced by the stored image URL.
Validation rules and error bodies match the Express version; see
`apps/api/docs/product-demo.openapi.yaml` (it lists this server too).

## Run

```
pnpm java:dev      # mvn spring-boot:run, listens on http://localhost:4001
pnpm java:build    # builds target/java-api-0.1.0.jar
```

Both scripts use `settings-central.xml` (`mvn -s ...`) so dependencies come from
public Maven Central and `~/.m2/settings.xml` is ignored. If your network needs a
corporate mirror, remove the `-s apps/java-api/settings-central.xml` part from
the scripts in the root `package.json`.

## Connect the frontend

The Next route `apps/frontend/app/api/product-demo/route.ts` forwards to
`API_URL` (Express) by default. To use this server instead, add to
`apps/frontend/.env.local` and restart `pnpm dev`:

```
PRODUCT_API_URL=http://localhost:4001
```

Remove the line to switch back to Express.

## Layout

```
src/main/java/com/nextcms/productdemo/
  ProductDemoApplication.java   Entry point.
  ProductDemoController.java    POST/GET/PUT /demo/products: reads parts, validates, pairs ids <-> files.
  ProductStore.java             Maps the API's JSON to/from the database tables.
  ProductEntity.java            JPA entity for table `product`.
  ProductImageEntity.java       JPA entity for table `product_image` (one row per image).
  ProductRepository.java        Spring Data repository for `product`.
  ImageStorageService.java      Writes/deletes files in ./uploads and returns their URL.
  WebConfig.java                Serves ./uploads at /uploads/**.
  ApiExceptionHandler.java      Multipart errors -> { success:false, error } 400s.
src/main/resources/application.properties   Port, 5 MB/file limit, upload dir.
```

## Database

H2 in file mode, created automatically on first start at `apps/java-api/data/productdb.mv.db`
(git-ignored). Tables (`ddl-auto=update`):

| Table | Columns |
|---|---|
| `product` | `id`, `category`, `ssr_code`, `price`, `pdf_url`, `details` (the rest of the product JSON) |
| `product_image` | `id`, `product_id` (FK), `position`, `url`, `description` — one row per image |

On update the stored image rows are compared with the submitted list: rows that
are no longer listed are deleted together with their files in `uploads/`. The
database is written first and old files are deleted only after it succeeds; if the
database write fails, the newly uploaded files are removed again.

Browse the tables at http://localhost:4001/h2-console (JDBC URL
`jdbc:h2:file:./data/productdb`, user `sa`, empty password). Only one process can
open the database file at a time, so stop the server before using another tool on it.
Override the location with the `DB_URL` environment variable. For PostgreSQL or
MySQL, change the datasource settings and swap the `h2` dependency in `pom.xml`.

Uploaded files go to `apps/java-api/uploads/` (git-ignored). Swap
`ImageStorageService` for S3 or similar in a real service.

## Security (login)

The API is a stateless OAuth2 resource server (`security/SecurityConfig.java`). It
trusts only a valid bearer token from the identity provider and has no login logic or
sessions of its own. See `docs/ibe-login.md` for the whole flow.

- **Protected:** everything under `/api/**` (example: `GET /api/bookings/me`, and
  `GET /api/bookings`, which also needs the `booking.read` scope).
- **Still open:** `/demo/**` (the product demo), `/uploads/**` and `/h2-console/**`.
- **Checked on every token:** signature (keys from the issuer's JWKS), `iss`, `exp`,
  `nbf` and `aud`. The caller is identified by the token's `sub`, never by anything in
  the request body, query or headers. Access tokens with the JOSE header `typ: at+jwt`
  (RFC 9068) are accepted as well as `JWT`.
- **Config:** `OIDC_ISSUER` (default `http://localhost:9000`, the mock IdP) and
  `API_AUDIENCE` (default `ibe-api`). The issuer's keys are fetched on the first token,
  so the API starts and the open endpoints work even when the IdP is down; protected
  calls then answer `503 identity_provider_unavailable` (not 401).
- **Opaque tokens:** if the vendor's access tokens are not JWTs, switch the resource
  server to token introspection instead (see the guide, section 6.5).
- **Tests:** `mvn -s apps/java-api/settings-central.xml -f apps/java-api test`.
