import type * as prismic from "@prismicio/client";

type Simplify<T> = { [KeyType in keyof T]: T[KeyType] };


type PickContentRelationshipFieldData<
	TRelationship extends prismic.CustomTypeModelFetchCustomTypeLevel1 | prismic.CustomTypeModelFetchCustomTypeLevel2 | prismic.CustomTypeModelFetchGroupLevel1 | prismic.CustomTypeModelFetchGroupLevel2,
	TData extends Record<string, prismic.AnyRegularField | prismic.GroupField | prismic.NestedGroupField | prismic.SliceZone>,
	TLang extends string
> = |
	// Content relationship fields
	{
		[TSubRelationship in Extract<
			TRelationship["fields"][number], prismic.CustomTypeModelFetchContentRelationshipLevel1
		> as TSubRelationship["id"]]:
			ContentRelationshipFieldWithData<TSubRelationship["customtypes"], TLang>;
	} &
	// Group
	{
		[TGroup in Extract<
			TRelationship["fields"][number], prismic.CustomTypeModelFetchGroupLevel1 | prismic.CustomTypeModelFetchGroupLevel2
		> as TGroup["id"]]:
			TData[TGroup["id"]] extends prismic.GroupField<infer TGroupData>
				? prismic.GroupField<PickContentRelationshipFieldData<TGroup, TGroupData, TLang>>
				: never
	} &
	// Other fields
	{
		[TFieldKey in Extract<TRelationship["fields"][number], string>]:
			TFieldKey extends keyof TData ? TData[TFieldKey] : never;
	};

type ContentRelationshipFieldWithData<
	TCustomType extends readonly (prismic.CustomTypeModelFetchCustomTypeLevel1 | string)[] | readonly (prismic.CustomTypeModelFetchCustomTypeLevel2 | string)[],
	TLang extends string = string
> = {
	[ID in Exclude<TCustomType[number], string>["id"]]:
		prismic.ContentRelationshipField<
			ID,
			TLang,
			PickContentRelationshipFieldData<
				Extract<TCustomType[number], { id: ID }>,
				Extract<prismic.Content.AllDocumentTypes, { type: ID }>["data"],
				TLang
			>
		>
}[Exclude<TCustomType[number], string>["id"]];

/**
 * Content for App Labels documents
 */
interface AppLabelsDocumentData {
	/**
	 * Header field in *App Labels*
	 *
	 * - **Field Type**: Content Relationship
	 * - **Placeholder**: *None*
	 * - **API ID Path**: app_labels.header
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/content-relationship
	 */
	header: prismic.ContentRelationshipField<"header">;
	
	/**
	 * Footer field in *App Labels*
	 *
	 * - **Field Type**: Content Relationship
	 * - **Placeholder**: *None*
	 * - **API ID Path**: app_labels.footer
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/content-relationship
	 */
	footer: prismic.ContentRelationshipField<"footer">;
	
	/**
	 * Home Page field in *App Labels*
	 *
	 * - **Field Type**: Content Relationship
	 * - **Placeholder**: *None*
	 * - **API ID Path**: app_labels.home_page
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/content-relationship
	 */
	home_page: prismic.ContentRelationshipField<"home_page">;
	
	/**
	 * Login Page field in *App Labels*
	 *
	 * - **Field Type**: Content Relationship
	 * - **Placeholder**: *None*
	 * - **API ID Path**: app_labels.login_page
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/content-relationship
	 */
	login_page: prismic.ContentRelationshipField<"login_page">;
	
	/**
	 * Login Form field in *App Labels*
	 *
	 * - **Field Type**: Content Relationship
	 * - **Placeholder**: *None*
	 * - **API ID Path**: app_labels.login_form
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/content-relationship
	 */
	login_form: prismic.ContentRelationshipField<"login_form">;
	
	/**
	 * Auth Nav field in *App Labels*
	 *
	 * - **Field Type**: Content Relationship
	 * - **Placeholder**: *None*
	 * - **API ID Path**: app_labels.auth_nav
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/content-relationship
	 */
	auth_nav: prismic.ContentRelationshipField<"auth_nav">;
}

/**
 * App Labels document from Prismic
 *
 * - **API ID**: `app_labels`
 * - **Repeatable**: `false`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type AppLabelsDocument<Lang extends string = string> = prismic.PrismicDocumentWithoutUID<Simplify<AppLabelsDocumentData>, "app_labels", Lang>;

/**
 * Content for Auth Nav documents
 */
interface AuthNavDocumentData {
	/**
	 * Sign In field in *Auth Nav*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: auth_nav.signIn
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	signIn: prismic.KeyTextField;
	
	/**
	 * Sign Out field in *Auth Nav*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: auth_nav.signOut
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	signOut: prismic.KeyTextField;
}

/**
 * Auth Nav document from Prismic
 *
 * - **API ID**: `auth_nav`
 * - **Repeatable**: `false`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type AuthNavDocument<Lang extends string = string> = prismic.PrismicDocumentWithoutUID<Simplify<AuthNavDocumentData>, "auth_nav", Lang>;

type ContentPageDocumentDataHeadingSlice = PageTitleSlice | BreadcrumbsSlice

type ContentPageDocumentDataMainSlice = AccordionSlice | BreadcrumbsSlice | ButtonLinkSlice | CalloutSlice | DisclosureListSlice | FaqAnswerSwapSlice | FaqQuestionListSlice | FileDownloadListSlice | ImageBlockSlice | InfoCardListSlice | LinkListSlice | PageTitleSlice | RichTextSectionSlice

type ContentPageDocumentDataAsideSlice = AccordionSlice | BreadcrumbsSlice | ButtonLinkSlice | CalloutSlice | DisclosureListSlice | FaqQuestionListSlice | FileDownloadListSlice | ImageBlockSlice | InfoCardListSlice | LinkListSlice | PageTitleSlice | RichTextSectionSlice

type ContentPageDocumentDataFooterSlice = AccordionSlice | BreadcrumbsSlice | ButtonLinkSlice | CalloutSlice | DisclosureListSlice | FaqQuestionListSlice | FileDownloadListSlice | ImageBlockSlice | InfoCardListSlice | LinkListSlice | PageTitleSlice | RichTextSectionSlice

/**
 * Content for Content Page documents
 */
interface ContentPageDocumentData {
	/**
	 * Meta Title field in *Content Page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: Title shown in search results and browser tabs
	 * - **API ID Path**: content_page.meta_title
	 * - **Tab**: Meta
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	meta_title: prismic.KeyTextField;

	/**
	 * Meta Description field in *Content Page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: Summary shown in search results (~150-160 characters)
	 * - **API ID Path**: content_page.meta_description
	 * - **Tab**: Meta
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	meta_description: prismic.KeyTextField;

	/**
	 * Breadcrumb Level 1 Label field in *Content Page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: content_page.breadcrumb_level_1_label
	 * - **Tab**: Heading
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	breadcrumb_level_1_label: prismic.KeyTextField;
	
	/**
	 * Breadcrumb Level 1 Href field in *Content Page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: content_page.breadcrumb_level_1_href
	 * - **Tab**: Heading
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	breadcrumb_level_1_href: prismic.KeyTextField;
	
	/**
	 * Breadcrumb Level 2 Label field in *Content Page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: content_page.breadcrumb_level_2_label
	 * - **Tab**: Heading
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	breadcrumb_level_2_label: prismic.KeyTextField;
	
	/**
	 * Breadcrumb Level 2 Href field in *Content Page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: content_page.breadcrumb_level_2_href
	 * - **Tab**: Heading
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	breadcrumb_level_2_href: prismic.KeyTextField;
	
	/**
	 * Breadcrumb Level 3 Label field in *Content Page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: content_page.breadcrumb_level_3_label
	 * - **Tab**: Heading
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	breadcrumb_level_3_label: prismic.KeyTextField;
	
	/**
	 * Breadcrumb Level 3 Href field in *Content Page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: content_page.breadcrumb_level_3_href
	 * - **Tab**: Heading
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	breadcrumb_level_3_href: prismic.KeyTextField;
	
	/**
	 * Heading Slice Zone field in *Content Page*
	 *
	 * - **Field Type**: Slice Zone
	 * - **Placeholder**: *None*
	 * - **API ID Path**: content_page.heading[]
	 * - **Tab**: Heading
	 * - **Documentation**: https://prismic.io/docs/slices
	 */
	heading: prismic.SliceZone<ContentPageDocumentDataHeadingSlice>;/**
	 * Main Slice Zone field in *Content Page*
	 *
	 * - **Field Type**: Slice Zone
	 * - **Placeholder**: *None*
	 * - **API ID Path**: content_page.main[]
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/slices
	 */
	main: prismic.SliceZone<ContentPageDocumentDataMainSlice>;/**
	 * Aside Slice Zone field in *Content Page*
	 *
	 * - **Field Type**: Slice Zone
	 * - **Placeholder**: *None*
	 * - **API ID Path**: content_page.aside[]
	 * - **Tab**: Aside
	 * - **Documentation**: https://prismic.io/docs/slices
	 */
	aside: prismic.SliceZone<ContentPageDocumentDataAsideSlice>;/**
	 * Footer Slice Zone field in *Content Page*
	 *
	 * - **Field Type**: Slice Zone
	 * - **Placeholder**: *None*
	 * - **API ID Path**: content_page.footer[]
	 * - **Tab**: Footer
	 * - **Documentation**: https://prismic.io/docs/slices
	 */
	footer: prismic.SliceZone<ContentPageDocumentDataFooterSlice>;
}

/**
 * Content Page document from Prismic
 *
 * - **API ID**: `content_page`
 * - **Repeatable**: `true`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type ContentPageDocument<Lang extends string = string> = prismic.PrismicDocumentWithUID<Simplify<ContentPageDocumentData>, "content_page", Lang>;

/**
 * Content for Footer documents
 */
interface FooterDocumentData {
	/**
	 * Copyright field in *Footer*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.copyright
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	copyright: prismic.KeyTextField;
	
	/**
	 * Home field in *Footer*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.home
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	home: prismic.KeyTextField;
	
	/**
	 * Sign In field in *Footer*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.signIn
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	signIn: prismic.KeyTextField;
}

/**
 * Footer document from Prismic
 *
 * - **API ID**: `footer`
 * - **Repeatable**: `false`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type FooterDocument<Lang extends string = string> = prismic.PrismicDocumentWithoutUID<Simplify<FooterDocumentData>, "footer", Lang>;

/**
 * Content for Header documents
 */
interface HeaderDocumentData {
	/**
	 * Brand field in *Header*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: header.brand
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	brand: prismic.KeyTextField;
	
	/**
	 * Home field in *Header*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: header.home
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	home: prismic.KeyTextField;
}

/**
 * Header document from Prismic
 *
 * - **API ID**: `header`
 * - **Repeatable**: `false`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type HeaderDocument<Lang extends string = string> = prismic.PrismicDocumentWithoutUID<Simplify<HeaderDocumentData>, "header", Lang>;

/**
 * Content for Home Page documents
 */
interface HomePageDocumentData {
	/**
	 * Title field in *Home Page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: home_page.title
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * Description field in *Home Page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: home_page.description
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	description: prismic.KeyTextField;
}

/**
 * Home Page document from Prismic
 *
 * - **API ID**: `home_page`
 * - **Repeatable**: `false`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type HomePageDocument<Lang extends string = string> = prismic.PrismicDocumentWithoutUID<Simplify<HomePageDocumentData>, "home_page", Lang>;

/**
 * Content for Login Form documents
 */
interface LoginFormDocumentData {
	/**
	 * Email field in *Login Form*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: login_form.email
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	email: prismic.KeyTextField;
	
	/**
	 * Password field in *Login Form*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: login_form.password
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	password: prismic.KeyTextField;
	
	/**
	 * Submit field in *Login Form*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: login_form.submit
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	submit: prismic.KeyTextField;
	
	/**
	 * Submitting field in *Login Form*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: login_form.submitting
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	submitting: prismic.KeyTextField;
	
	/**
	 * Login Failed field in *Login Form*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: login_form.loginFailed
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	loginFailed: prismic.KeyTextField;
	
	/**
	 * Generic Error field in *Login Form*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: login_form.genericError
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	genericError: prismic.KeyTextField;
}

/**
 * Login Form document from Prismic
 *
 * - **API ID**: `login_form`
 * - **Repeatable**: `false`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type LoginFormDocument<Lang extends string = string> = prismic.PrismicDocumentWithoutUID<Simplify<LoginFormDocumentData>, "login_form", Lang>;

/**
 * Content for Login Page documents
 */
interface LoginPageDocumentData {
	/**
	 * Title field in *Login Page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: login_page.title
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * Description field in *Login Page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: login_page.description
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	description: prismic.KeyTextField;
	
	/**
	 * Card Title field in *Login Page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: login_page.cardTitle
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	cardTitle: prismic.KeyTextField;
	
	/**
	 * Card Description field in *Login Page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: login_page.cardDescription
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	cardDescription: prismic.KeyTextField;
}

/**
 * Login Page document from Prismic
 *
 * - **API ID**: `login_page`
 * - **Repeatable**: `false`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type LoginPageDocument<Lang extends string = string> = prismic.PrismicDocumentWithoutUID<Simplify<LoginPageDocumentData>, "login_page", Lang>;

export type AllDocumentTypes = AppLabelsDocument | AuthNavDocument | ContentPageDocument | FooterDocument | HeaderDocument | HomePageDocument | LoginFormDocument | LoginPageDocument;

/**
 * Primary content in *Accordion → Items*
 */
export interface AccordionSliceDefaultItem {
	/**
	 * Title field in *Accordion → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: accordion.items[].title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * Highlighted Note field in *Accordion → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: accordion.items[].note
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	note: prismic.KeyTextField;
	
	/**
	 * Body field in *Accordion → Items*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: accordion.items[].body
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	body: prismic.RichTextField;
	
	/**
	 * Necessities Heading field in *Accordion → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: accordion.items[].necessities_heading
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	necessities_heading: prismic.KeyTextField;
	
	/**
	 * Necessities field in *Accordion → Items*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: accordion.items[].necessities
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	necessities: prismic.RichTextField;
	
	/**
	 * Link Label field in *Accordion → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: accordion.items[].link_label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	link_label: prismic.KeyTextField;
	
	/**
	 * Link field in *Accordion → Items*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: accordion.items[].link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
	
	/**
	 * Second Link Label field in *Accordion → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: accordion.items[].link2_label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	link2_label: prismic.KeyTextField;
	
	/**
	 * Second Link field in *Accordion → Items*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: accordion.items[].link2
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	link2: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
}

/**
 * Default variation for Accordion Slice
 *
 * - **API ID**: `default`
 * - **Description**: Numbered accordion items
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type AccordionSliceDefault = prismic.SharedSliceVariation<"default", Record<string, never>, Simplify<AccordionSliceDefaultItem>>;

/**
 * Slice variation for *Accordion*
 */
type AccordionSliceVariation = AccordionSliceDefault

/**
 * Accordion Shared Slice
 *
 * - **API ID**: `accordion`
 * - **Description**: Numbered, individually collapsible sections (e.g. a step-by-step process)
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type AccordionSlice = prismic.SharedSlice<"accordion", AccordionSliceVariation>;

/**
 * Primary content in *Breadcrumbs → Default → Primary*
 */
export interface BreadcrumbsSliceDefaultPrimary {
	/**
	 * Separator field in *Breadcrumbs → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: /
	 * - **API ID Path**: breadcrumbs.default.primary.separator
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	separator: prismic.KeyTextField;
}

/**
 * Default variation for Breadcrumbs Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type BreadcrumbsSliceDefault = prismic.SharedSliceVariation<"default", Simplify<BreadcrumbsSliceDefaultPrimary>, never>;

/**
 * Slice variation for *Breadcrumbs*
 */
type BreadcrumbsSliceVariation = BreadcrumbsSliceDefault

/**
 * Breadcrumbs Shared Slice
 *
 * - **API ID**: `breadcrumbs`
 * - **Description**: Breadcrumbs
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type BreadcrumbsSlice = prismic.SharedSlice<"breadcrumbs", BreadcrumbsSliceVariation>;

/**
 * Primary content in *ButtonLink → Default → Primary*
 */
export interface ButtonLinkSliceDefaultPrimary {
	/**
	 * Label field in *ButtonLink → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: button_link.default.primary.label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	label: prismic.KeyTextField;
	
	/**
	 * Link field in *ButtonLink → Default → Primary*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: button_link.default.primary.link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
	
	/**
	 * Style field in *ButtonLink → Default → Primary*
	 *
	 * - **Field Type**: Select
	 * - **Placeholder**: *None*
	 * - **Default Value**: Outline
	 * - **API ID Path**: button_link.default.primary.style
	 * - **Documentation**: https://prismic.io/docs/fields/select
	 */
	style: prismic.SelectField<"Solid" | "Outline", "filled">;
	
	/**
	 * Icon left field in *ButtonLink → Default → Primary*
	 *
	 * - **Field Type**: Select
	 * - **Placeholder**: None
	 * - **API ID Path**: button_link.default.primary.icon_left
	 * - **Documentation**: https://prismic.io/docs/fields/select
	 */
	icon_left: prismic.SelectField<"ArrowLeft" | "ArrowRight" | "ChevronLeft" | "ChevronRight" | "Download" | "ExternalLink" | "Check">;
	
	/**
	 * Icon right field in *ButtonLink → Default → Primary*
	 *
	 * - **Field Type**: Select
	 * - **Placeholder**: None
	 * - **API ID Path**: button_link.default.primary.icon_right
	 * - **Documentation**: https://prismic.io/docs/fields/select
	 */
	icon_right: prismic.SelectField<"ArrowLeft" | "ArrowRight" | "ChevronLeft" | "ChevronRight" | "Download" | "ExternalLink" | "Check">;
}

/**
 * Default variation for ButtonLink Slice
 *
 * - **API ID**: `default`
 * - **Description**: Centered button (solid or outline) with optional icons
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type ButtonLinkSliceDefault = prismic.SharedSliceVariation<"default", Simplify<ButtonLinkSliceDefaultPrimary>, never>;

/**
 * Slice variation for *ButtonLink*
 */
type ButtonLinkSliceVariation = ButtonLinkSliceDefault

/**
 * ButtonLink Shared Slice
 *
 * - **API ID**: `button_link`
 * - **Description**: A single centered button linking to another page, with optional left/right icon and solid/outline style
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type ButtonLinkSlice = prismic.SharedSlice<"button_link", ButtonLinkSliceVariation>;

/**
 * Primary content in *Callout → Default → Primary*
 */
export interface CalloutSliceDefaultPrimary {
	/**
	 * Style field in *Callout → Default → Primary*
	 *
	 * - **Field Type**: Select
	 * - **Placeholder**: *None*
	 * - **Default Value**: Neutral
	 * - **API ID Path**: callout.default.primary.style
	 * - **Documentation**: https://prismic.io/docs/fields/select
	 */
	style: prismic.SelectField<"Neutral" | "Info" | "Warning" | "Success", "filled">;
	
	/**
	 * Heading field in *Callout → Default → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: callout.default.primary.heading
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	heading: prismic.RichTextField;
	
	/**
	 * Body field in *Callout → Default → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: callout.default.primary.body
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	body: prismic.RichTextField;
}

/**
 * Default variation for Callout Slice
 *
 * - **API ID**: `default`
 * - **Description**: Bordered callout box
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type CalloutSliceDefault = prismic.SharedSliceVariation<"default", Simplify<CalloutSliceDefaultPrimary>, never>;

/**
 * Slice variation for *Callout*
 */
type CalloutSliceVariation = CalloutSliceDefault

/**
 * Callout Shared Slice
 *
 * - **API ID**: `callout`
 * - **Description**: A bordered, colored box for a multi-line note/warning/highlighted block
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type CalloutSlice = prismic.SharedSlice<"callout", CalloutSliceVariation>;

/**
 * Item in *DisclosureList → Default → Primary → Files*
 */
export interface DisclosureListSliceDefaultPrimaryFilesItem {
	/**
	 * Label field in *DisclosureList → Default → Primary → Files*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: disclosure_list.default.primary.files[].label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	label: prismic.KeyTextField;
	
	/**
	 * File field in *DisclosureList → Default → Primary → Files*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: disclosure_list.default.primary.files[].file
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	file: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
	
	/**
	 * File Size field in *DisclosureList → Default → Primary → Files*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: disclosure_list.default.primary.files[].file_size
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	file_size: prismic.KeyTextField;
}

/**
 * Primary content in *DisclosureList → Default → Primary*
 */
export interface DisclosureListSliceDefaultPrimary {
	/**
	 * Title field in *DisclosureList → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: disclosure_list.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * Body field in *DisclosureList → Default → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: disclosure_list.default.primary.body
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	body: prismic.RichTextField;
	
	/**
	 * Box Heading field in *DisclosureList → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: disclosure_list.default.primary.box_heading
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	box_heading: prismic.KeyTextField;
	
	/**
	 * Box Body field in *DisclosureList → Default → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: disclosure_list.default.primary.box_body
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	box_body: prismic.RichTextField;
	
	/**
	 * Files field in *DisclosureList → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: disclosure_list.default.primary.files[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	files: prismic.GroupField<Simplify<DisclosureListSliceDefaultPrimaryFilesItem>>;
	
	/**
	 * Link Label field in *DisclosureList → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: disclosure_list.default.primary.link_label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	link_label: prismic.KeyTextField;
	
	/**
	 * Link field in *DisclosureList → Default → Primary*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: disclosure_list.default.primary.link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
}

/**
 * Default variation for DisclosureList Slice
 *
 * - **API ID**: `default`
 * - **Description**: Toggleable section
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type DisclosureListSliceDefault = prismic.SharedSliceVariation<"default", Simplify<DisclosureListSliceDefaultPrimary>, never>;

/**
 * Slice variation for *DisclosureList*
 */
type DisclosureListSliceVariation = DisclosureListSliceDefault

/**
 * DisclosureList Shared Slice
 *
 * - **API ID**: `disclosure_list`
 * - **Description**: One collapsible topic, with an optional highlighted box, an optional list of download buttons inside that box, and an optional trailing link
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type DisclosureListSlice = prismic.SharedSlice<"disclosure_list", DisclosureListSliceVariation>;

/**
 * Item in *FaqAccordion → Default → Primary → QA*
 */
export interface FaqAccordionSliceDefaultPrimaryQaItem {
	/**
	 * question field in *FaqAccordion → Default → Primary → QA*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_accordion.default.primary.qa[].question
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	question: prismic.KeyTextField;
	
	/**
	 * answer field in *FaqAccordion → Default → Primary → QA*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_accordion.default.primary.qa[].answer
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	answer: prismic.RichTextField;
}

/**
 * Item in *FaqAccordion → Sidebar Navigation → Primary → links*
 */
export interface FaqAccordionSliceSidebarNavPrimaryLinksItem {
	/**
	 * Category (e.g. Flight Booking) field in *FaqAccordion → Sidebar Navigation → Primary → links*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_accordion.sidebar_nav.primary.links[].category_title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	category_title: prismic.KeyTextField;
	
	/**
	 * Sub-link label (e.g. Routes & Timetable) field in *FaqAccordion → Sidebar Navigation → Primary → links*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_accordion.sidebar_nav.primary.links[].link_label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	link_label: prismic.KeyTextField;
	
	/**
	 * Topic Key field in *FaqAccordion → Sidebar Navigation → Primary → links*
	 *
	 * - **Field Type**: Select
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_accordion.sidebar_nav.primary.links[].topic
	 * - **Documentation**: https://prismic.io/docs/fields/select
	 */
	topic: prismic.SelectField<"routes-timetable" | "reservation" | "payment" | "fare" | "zipair-point" | "connecting-flights" | "receipt-itinerary" | "purchase-error" | "voucher" | "travel-documents" | "other-errors">;
}

/**
 * Primary content in *FaqAccordion → Default → Primary*
 */
export interface FaqAccordionSliceDefaultPrimary {
	/**
	 * title field in *FaqAccordion → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_accordion.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * QA field in *FaqAccordion → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_accordion.default.primary.qa[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	qa: prismic.GroupField<Simplify<FaqAccordionSliceDefaultPrimaryQaItem>>;
}

/**
 * Default variation for FaqAccordion Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FaqAccordionSliceDefault = prismic.SharedSliceVariation<"default", Simplify<FaqAccordionSliceDefaultPrimary>, never>;

/**
 * Primary content in *FaqAccordion → Sidebar Navigation → Primary*
 */
export interface FaqAccordionSliceSidebarNavPrimary {
	/**
	 * links field in *FaqAccordion → Sidebar Navigation → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_accordion.sidebar_nav.primary.links[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	links: prismic.GroupField<Simplify<FaqAccordionSliceSidebarNavPrimaryLinksItem>>;
}

/**
 * Sidebar Navigation variation for FaqAccordion Slice
 *
 * - **API ID**: `sidebar_nav`
 * - **Description**: Sidebar Navigation
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FaqAccordionSliceSidebarNav = prismic.SharedSliceVariation<"sidebar_nav", Simplify<FaqAccordionSliceSidebarNavPrimary>, never>;

/**
 * Slice variation for *FaqAccordion*
 */
type FaqAccordionSliceVariation = FaqAccordionSliceDefault | FaqAccordionSliceSidebarNav

/**
 * FaqAccordion Shared Slice
 *
 * - **API ID**: `faq_accordion`
 * - **Description**: FaqAccordion
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FaqAccordionSlice = prismic.SharedSlice<"faq_accordion", FaqAccordionSliceVariation>;

/**
 * Primary content in *FaqAnswerSwap → Default → Primary*
 */
export interface FaqAnswerSwapSliceDefaultPrimary {
	/**
	 * Related heading field in *FaqAnswerSwap → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: Related question
	 * - **API ID Path**: faq_answer_swap.default.primary.related_heading
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	related_heading: prismic.KeyTextField;
}

/**
 * Primary content in *FaqAnswerSwap → Items*
 */
export interface FaqAnswerSwapSliceDefaultItem {
	/**
	 * Question field in *FaqAnswerSwap → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_answer_swap.items[].question
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	question: prismic.KeyTextField;
	
	/**
	 * Answer field in *FaqAnswerSwap → Items*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_answer_swap.items[].answer
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	answer: prismic.RichTextField;
}

/**
 * Default variation for FaqAnswerSwap Slice
 *
 * - **API ID**: `default`
 * - **Description**: Active question/answer card + related-question list
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FaqAnswerSwapSliceDefault = prismic.SharedSliceVariation<"default", Simplify<FaqAnswerSwapSliceDefaultPrimary>, Simplify<FaqAnswerSwapSliceDefaultItem>>;

/**
 * Slice variation for *FaqAnswerSwap*
 */
type FaqAnswerSwapSliceVariation = FaqAnswerSwapSliceDefault

/**
 * FaqAnswerSwap Shared Slice
 *
 * - **API ID**: `faq_answer_swap`
 * - **Description**: A Q&A card with a related-question switcher that swaps the active answer client-side, no page navigation
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FaqAnswerSwapSlice = prismic.SharedSlice<"faq_answer_swap", FaqAnswerSwapSliceVariation>;

/**
 * Primary content in *FaqQuestionList → Default → Primary*
 */
export interface FaqQuestionListSliceDefaultPrimary {
	/**
	 * Heading field in *FaqQuestionList → Default → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.default.primary.heading
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	heading: prismic.RichTextField;
	
	/**
	 * Description field in *FaqQuestionList → Default → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.default.primary.description
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	description: prismic.RichTextField;
	
	/**
	 * number field in *FaqQuestionList → Default → Primary*
	 *
	 * - **Field Type**: Number
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.default.primary.number
	 * - **Documentation**: https://prismic.io/docs/fields/number
	 */
	number: prismic.NumberField;
	
	/**
	 * text field in *FaqQuestionList → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.default.primary.text
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	text: prismic.KeyTextField;
}

/**
 * Primary content in *FaqQuestionList → Items*
 */
export interface FaqQuestionListSliceDefaultItem {
	/**
	 * Question field in *FaqQuestionList → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.items[].question
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	question: prismic.KeyTextField;
	
	/**
	 * Href field in *FaqQuestionList → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.items[].href
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	href: prismic.KeyTextField;
}

/**
 * Default variation for FaqQuestionList Slice
 *
 * - **API ID**: `default`
 * - **Description**: Category page list of FAQ questions
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FaqQuestionListSliceDefault = prismic.SharedSliceVariation<"default", Simplify<FaqQuestionListSliceDefaultPrimary>, Simplify<FaqQuestionListSliceDefaultItem>>;

/**
 * Primary content in *FaqQuestionList → grid → Primary*
 */
export interface FaqQuestionListSliceGridPrimary {
	/**
	 * Heading field in *FaqQuestionList → grid → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.grid.primary.heading
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	heading: prismic.RichTextField;
	
	/**
	 * Description field in *FaqQuestionList → grid → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.grid.primary.description
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	description: prismic.RichTextField;
}

/**
 * Primary content in *FaqQuestionList → Items*
 */
export interface FaqQuestionListSliceGridItem {
	/**
	 * Question field in *FaqQuestionList → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.items[].question
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	question: prismic.KeyTextField;
	
	/**
	 * Href field in *FaqQuestionList → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.items[].href
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	href: prismic.KeyTextField;
}

/**
 * grid variation for FaqQuestionList Slice
 *
 * - **API ID**: `grid`
 * - **Description**: Category page list of FAQ questions
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FaqQuestionListSliceGrid = prismic.SharedSliceVariation<"grid", Simplify<FaqQuestionListSliceGridPrimary>, Simplify<FaqQuestionListSliceGridItem>>;

/**
 * Primary content in *FaqQuestionList → accordion → Primary*
 */
export interface FaqQuestionListSliceAccordionPrimary {
	/**
	 * Heading field in *FaqQuestionList → accordion → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.accordion.primary.heading
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	heading: prismic.RichTextField;
	
	/**
	 * Current Category (starts expanded) field in *FaqQuestionList → accordion → Primary*
	 *
	 * - **Field Type**: Boolean
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.accordion.primary.current
	 * - **Documentation**: https://prismic.io/docs/fields/boolean
	 */
	current: prismic.BooleanField;
}

/**
 * Primary content in *FaqQuestionList → Items*
 */
export interface FaqQuestionListSliceAccordionItem {
	/**
	 * Question field in *FaqQuestionList → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.items[].question
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	question: prismic.KeyTextField;
	
	/**
	 * Href field in *FaqQuestionList → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.items[].href
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	href: prismic.KeyTextField;
}

/**
 * accordion variation for FaqQuestionList Slice
 *
 * - **API ID**: `accordion`
 * - **Description**: Collapsible category block for a sidebar list of categories (e.g. FAQ aside navigation)
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FaqQuestionListSliceAccordion = prismic.SharedSliceVariation<"accordion", Simplify<FaqQuestionListSliceAccordionPrimary>, Simplify<FaqQuestionListSliceAccordionItem>>;

/**
 * Primary content in *FaqQuestionList → footer_grid → Primary*
 */
export interface FaqQuestionListSliceFooterGridPrimary {
	/**
	 * Heading field in *FaqQuestionList → footer_grid → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.footer_grid.primary.heading
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	heading: prismic.RichTextField;
	
	/**
	 * Mobile Section Heading field in *FaqQuestionList → footer_grid → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: e.g. User Guide -- set on the first tile only, shown above the whole grid on mobile
	 * - **API ID Path**: faq_question_list.footer_grid.primary.mobile_section_heading
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	mobile_section_heading: prismic.KeyTextField;
}

/**
 * Primary content in *FaqQuestionList → Items*
 */
export interface FaqQuestionListSliceFooterGridItem {
	/**
	 * Question field in *FaqQuestionList → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.items[].question
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	question: prismic.KeyTextField;
	
	/**
	 * Href field in *FaqQuestionList → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.items[].href
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	href: prismic.KeyTextField;
}

/**
 * footer_grid variation for FaqQuestionList Slice
 *
 * - **API ID**: `footer_grid`
 * - **Description**: Always-visible category tile for a multi-column footer grid (title + vertical link list, no collapse)
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FaqQuestionListSliceFooterGrid = prismic.SharedSliceVariation<"footer_grid", Simplify<FaqQuestionListSliceFooterGridPrimary>, Simplify<FaqQuestionListSliceFooterGridItem>>;

/**
 * Primary content in *FaqQuestionList → withicon → Primary*
 */
export interface FaqQuestionListSliceWithiconPrimary {
	/**
	 * Heading field in *FaqQuestionList → withicon → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.withicon.primary.heading
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	heading: prismic.RichTextField;
	
	/**
	 * Description field in *FaqQuestionList → withicon → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.withicon.primary.description
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	description: prismic.RichTextField;
}

/**
 * Primary content in *FaqQuestionList → Items*
 */
export interface FaqQuestionListSliceWithiconItem {
	/**
	 * Question field in *FaqQuestionList → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.items[].question
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	question: prismic.KeyTextField;
	
	/**
	 * Href field in *FaqQuestionList → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: faq_question_list.items[].href
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	href: prismic.KeyTextField;
}

/**
 * withicon variation for FaqQuestionList Slice
 *
 * - **API ID**: `withicon`
 * - **Description**: Category page list of FAQ questions
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FaqQuestionListSliceWithicon = prismic.SharedSliceVariation<"withicon", Simplify<FaqQuestionListSliceWithiconPrimary>, Simplify<FaqQuestionListSliceWithiconItem>>;

/**
 * Slice variation for *FaqQuestionList*
 */
type FaqQuestionListSliceVariation = FaqQuestionListSliceDefault | FaqQuestionListSliceGrid | FaqQuestionListSliceAccordion | FaqQuestionListSliceFooterGrid | FaqQuestionListSliceWithicon

/**
 * FaqQuestionList Shared Slice
 *
 * - **API ID**: `faq_question_list`
 * - **Description**: Question list with links to detail pages
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FaqQuestionListSlice = prismic.SharedSlice<"faq_question_list", FaqQuestionListSliceVariation>;

/**
 * Primary content in *FileDownloadList → Items*
 */
export interface FileDownloadListSliceDefaultItem {
	/**
	 * Button Label field in *FileDownloadList → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: file_download_list.items[].label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	label: prismic.KeyTextField;
	
	/**
	 * File field in *FileDownloadList → Items*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: file_download_list.items[].file
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	file: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
	
	/**
	 * File Size field in *FileDownloadList → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: e.g. 504KB
	 * - **API ID Path**: file_download_list.items[].file_size
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	file_size: prismic.KeyTextField;
}

/**
 * Default variation for FileDownloadList Slice
 *
 * - **API ID**: `default`
 * - **Description**: Download buttons with file size
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FileDownloadListSliceDefault = prismic.SharedSliceVariation<"default", Record<string, never>, Simplify<FileDownloadListSliceDefaultItem>>;

/**
 * Slice variation for *FileDownloadList*
 */
type FileDownloadListSliceVariation = FileDownloadListSliceDefault

/**
 * FileDownloadList Shared Slice
 *
 * - **API ID**: `file_download_list`
 * - **Description**: A row of outline download buttons, each with a label and file size caption (e.g. downloadable PDF forms)
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FileDownloadListSlice = prismic.SharedSlice<"file_download_list", FileDownloadListSliceVariation>;

/**
 * Primary content in *ImageBlock → Default → Primary*
 */
export interface ImageBlockSliceDefaultPrimary {
	/**
	 * Image field in *ImageBlock → Default → Primary*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: image_block.default.primary.image
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	image: prismic.ImageField<never>;
	
	/**
	 * Caption field in *ImageBlock → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: image_block.default.primary.caption
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	caption: prismic.KeyTextField;
}

/**
 * Default variation for ImageBlock Slice
 *
 * - **API ID**: `default`
 * - **Description**: Image with optional caption
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type ImageBlockSliceDefault = prismic.SharedSliceVariation<"default", Simplify<ImageBlockSliceDefaultPrimary>, never>;

/**
 * Slice variation for *ImageBlock*
 */
type ImageBlockSliceVariation = ImageBlockSliceDefault

/**
 * ImageBlock Shared Slice
 *
 * - **API ID**: `image_block`
 * - **Description**: A single image with an optional caption
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type ImageBlockSlice = prismic.SharedSlice<"image_block", ImageBlockSliceVariation>;

/**
 * Primary content in *InfoCardList → Items*
 */
export interface InfoCardListSliceDefaultItem {
	/**
	 * Title field in *InfoCardList → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: info_card_list.items[].title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * Body field in *InfoCardList → Items*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: info_card_list.items[].body
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	body: prismic.RichTextField;
}

/**
 * Default variation for InfoCardList Slice
 *
 * - **API ID**: `default`
 * - **Description**: Stacked info cards
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type InfoCardListSliceDefault = prismic.SharedSliceVariation<"default", Record<string, never>, Simplify<InfoCardListSliceDefaultItem>>;

/**
 * Slice variation for *InfoCardList*
 */
type InfoCardListSliceVariation = InfoCardListSliceDefault

/**
 * InfoCardList Shared Slice
 *
 * - **API ID**: `info_card_list`
 * - **Description**: A list of bordered info cards, each with a title and body text
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type InfoCardListSlice = prismic.SharedSlice<"info_card_list", InfoCardListSliceVariation>;

/**
 * Primary content in *LinkList → Default → Primary*
 */
export interface LinkListSliceDefaultPrimary {
	/**
	 * Heading field in *LinkList → Default → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: link_list.default.primary.heading
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	heading: prismic.RichTextField;
}

/**
 * Primary content in *LinkList → Items*
 */
export interface LinkListSliceDefaultItem {
	/**
	 * Label field in *LinkList → Items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: link_list.items[].label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	label: prismic.KeyTextField;
	
	/**
	 * Link field in *LinkList → Items*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: link_list.items[].link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
}

/**
 * Default variation for LinkList Slice
 *
 * - **API ID**: `default`
 * - **Description**: An optional heading followed by a vertical list of chevron links
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type LinkListSliceDefault = prismic.SharedSliceVariation<"default", Simplify<LinkListSliceDefaultPrimary>, Simplify<LinkListSliceDefaultItem>>;

/**
 * Slice variation for *LinkList*
 */
type LinkListSliceVariation = LinkListSliceDefault

/**
 * LinkList Shared Slice
 *
 * - **API ID**: `link_list`
 * - **Description**: Stacked chevron links (e.g. related links following a text section)
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type LinkListSlice = prismic.SharedSlice<"link_list", LinkListSliceVariation>;

/**
 * Primary content in *PageTitle → Default → Primary*
 */
export interface PageTitleSliceDefaultPrimary {
	/**
	 * Title field in *PageTitle → Default → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: page_title.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	title: prismic.RichTextField;
	
	/**
	 * Subtitle field in *PageTitle → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: page_title.default.primary.subtitle
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	subtitle: prismic.KeyTextField;
}

/**
 * Default variation for PageTitle Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type PageTitleSliceDefault = prismic.SharedSliceVariation<"default", Simplify<PageTitleSliceDefaultPrimary>, never>;

/**
 * Slice variation for *PageTitle*
 */
type PageTitleSliceVariation = PageTitleSliceDefault

/**
 * PageTitle Shared Slice
 *
 * - **API ID**: `page_title`
 * - **Description**: PageTitle
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type PageTitleSlice = prismic.SharedSlice<"page_title", PageTitleSliceVariation>;

/**
 * Item in *QuestionAnswerSlice → Default → Primary → items*
 */
export interface QuestionAnswerSliceSliceDefaultPrimaryItemsItem {
	/**
	 * Topic Key (must match FaqAccordion's topic field) field in *QuestionAnswerSlice → Default → Primary → items*
	 *
	 * - **Field Type**: Select
	 * - **Placeholder**: *None*
	 * - **API ID Path**: question_answer_slice.default.primary.items[].topic
	 * - **Documentation**: https://prismic.io/docs/fields/select
	 */
	topic: prismic.SelectField<"routes-timetable" | "reservation" | "payment" | "fare" | "zipair-point" | "connecting-flights" | "receipt-itinerary" | "purchase-error" | "voucher" | "travel-documents" | "other-errors">;
	
	/**
	 * question field in *QuestionAnswerSlice → Default → Primary → items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: question_answer_slice.default.primary.items[].question
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	question: prismic.KeyTextField;
	
	/**
	 * answer field in *QuestionAnswerSlice → Default → Primary → items*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: question_answer_slice.default.primary.items[].answer
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	answer: prismic.RichTextField;
	
	/**
	 * related question label field in *QuestionAnswerSlice → Default → Primary → items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: question_answer_slice.default.primary.items[].related_question_label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	related_question_label: prismic.KeyTextField;
	
	/**
	 * related question link field in *QuestionAnswerSlice → Default → Primary → items*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: question_answer_slice.default.primary.items[].related_question_link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	related_question_link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
}

/**
 * Primary content in *QuestionAnswerSlice → Default → Primary*
 */
export interface QuestionAnswerSliceSliceDefaultPrimary {
	/**
	 * Topic shown on initial page load field in *QuestionAnswerSlice → Default → Primary*
	 *
	 * - **Field Type**: Select
	 * - **Placeholder**: *None*
	 * - **API ID Path**: question_answer_slice.default.primary.default_topic
	 * - **Documentation**: https://prismic.io/docs/fields/select
	 */
	default_topic: prismic.SelectField<"routes-timetable" | "reservation" | "payment" | "fare" | "zipair-point" | "connecting-flights" | "receipt-itinerary" | "purchase-error" | "voucher" | "travel-documents" | "other-errors">;
	
	/**
	 * items field in *QuestionAnswerSlice → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: question_answer_slice.default.primary.items[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	items: prismic.GroupField<Simplify<QuestionAnswerSliceSliceDefaultPrimaryItemsItem>>;
}

/**
 * Default variation for QuestionAnswerSlice Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type QuestionAnswerSliceSliceDefault = prismic.SharedSliceVariation<"default", Simplify<QuestionAnswerSliceSliceDefaultPrimary>, never>;

/**
 * Slice variation for *QuestionAnswerSlice*
 */
type QuestionAnswerSliceSliceVariation = QuestionAnswerSliceSliceDefault

/**
 * QuestionAnswerSlice Shared Slice
 *
 * - **API ID**: `question_answer_slice`
 * - **Description**: QuestionAnswerSlice
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type QuestionAnswerSliceSlice = prismic.SharedSlice<"question_answer_slice", QuestionAnswerSliceSliceVariation>;

/**
 * Item in *QuestionListSlice → Default → Primary → questions*
 */
export interface QuestionListSliceSliceDefaultPrimaryQuestionsItem {
	/**
	 * Topic Key (must match FaqAccordion's topic field) field in *QuestionListSlice → Default → Primary → questions*
	 *
	 * - **Field Type**: Select
	 * - **Placeholder**: *None*
	 * - **API ID Path**: question_list_slice.default.primary.questions[].topic
	 * - **Documentation**: https://prismic.io/docs/fields/select
	 */
	topic: prismic.SelectField<"routes-timetable" | "reservation" | "payment" | "fare" | "zipair-point" | "connecting-flights" | "receipt-itinerary" | "purchase-error" | "voucher" | "travel-documents" | "other-errors">;
	
	/**
	 * heading field in *QuestionListSlice → Default → Primary → questions*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: question_list_slice.default.primary.questions[].heading
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	heading: prismic.KeyTextField;
	
	/**
	 * question field in *QuestionListSlice → Default → Primary → questions*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: question_list_slice.default.primary.questions[].question
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	question: prismic.KeyTextField;
	
	/**
	 * question link field in *QuestionListSlice → Default → Primary → questions*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: question_list_slice.default.primary.questions[].question_link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	question_link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
}

/**
 * Primary content in *QuestionListSlice → Default → Primary*
 */
export interface QuestionListSliceSliceDefaultPrimary {
	/**
	 * Topic shown on initial page load field in *QuestionListSlice → Default → Primary*
	 *
	 * - **Field Type**: Select
	 * - **Placeholder**: *None*
	 * - **API ID Path**: question_list_slice.default.primary.default_topic
	 * - **Documentation**: https://prismic.io/docs/fields/select
	 */
	default_topic: prismic.SelectField<"routes-timetable" | "reservation" | "payment" | "fare" | "zipair-point" | "connecting-flights" | "receipt-itinerary" | "purchase-error" | "voucher" | "travel-documents" | "other-errors">;
	
	/**
	 * questions field in *QuestionListSlice → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: question_list_slice.default.primary.questions[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	questions: prismic.GroupField<Simplify<QuestionListSliceSliceDefaultPrimaryQuestionsItem>>;
}

/**
 * Default variation for QuestionListSlice Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type QuestionListSliceSliceDefault = prismic.SharedSliceVariation<"default", Simplify<QuestionListSliceSliceDefaultPrimary>, never>;

/**
 * Slice variation for *QuestionListSlice*
 */
type QuestionListSliceSliceVariation = QuestionListSliceSliceDefault

/**
 * QuestionListSlice Shared Slice
 *
 * - **API ID**: `question_list_slice`
 * - **Description**: QuestionListSlice
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type QuestionListSliceSlice = prismic.SharedSlice<"question_list_slice", QuestionListSliceSliceVariation>;

/**
 * Primary content in *RichTextSection → Default → Primary*
 */
export interface RichTextSectionSliceDefaultPrimary {
	/**
	 * Heading field in *RichTextSection → Default → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: rich_text_section.default.primary.heading
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	heading: prismic.RichTextField;
	
	/**
	 * Body field in *RichTextSection → Default → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: rich_text_section.default.primary.body
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	body: prismic.RichTextField;
	
	/**
	 * Font Size field in *RichTextSection → Default → Primary*
	 *
	 * - **Field Type**: Select
	 * - **Placeholder**: *None*
	 * - **Default Value**: Medium
	 * - **API ID Path**: rich_text_section.default.primary.font_size
	 * - **Documentation**: https://prismic.io/docs/fields/select
	 */
	font_size: prismic.SelectField<"Small" | "Medium" | "Large", "filled">;
	
	/**
	 * Font Color field in *RichTextSection → Default → Primary*
	 *
	 * - **Field Type**: Select
	 * - **Placeholder**: *None*
	 * - **Default Value**: Default
	 * - **API ID Path**: rich_text_section.default.primary.font_color
	 * - **Documentation**: https://prismic.io/docs/fields/select
	 */
	font_color: prismic.SelectField<"Default" | "Muted" | "Accent", "filled">;
}

/**
 * Primary content in *RichTextSection → Items*
 */
export interface RichTextSectionSliceDefaultItem {
	/**
	 * Line Text field in *RichTextSection → Items*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: rich_text_section.items[].text
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	text: prismic.RichTextField;
	
	/**
	 * Font Size field in *RichTextSection → Items*
	 *
	 * - **Field Type**: Select
	 * - **Placeholder**: *None*
	 * - **Default Value**: Medium
	 * - **API ID Path**: rich_text_section.items[].font_size
	 * - **Documentation**: https://prismic.io/docs/fields/select
	 */
	font_size: prismic.SelectField<"Small" | "Medium" | "Large", "filled">;
	
	/**
	 * Font Color field in *RichTextSection → Items*
	 *
	 * - **Field Type**: Select
	 * - **Placeholder**: *None*
	 * - **Default Value**: Default
	 * - **API ID Path**: rich_text_section.items[].font_color
	 * - **Documentation**: https://prismic.io/docs/fields/select
	 */
	font_color: prismic.SelectField<"Default" | "Muted" | "Accent", "filled">;
}

/**
 * Default variation for RichTextSection Slice
 *
 * - **API ID**: `default`
 * - **Description**: Heading and body text
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type RichTextSectionSliceDefault = prismic.SharedSliceVariation<"default", Simplify<RichTextSectionSliceDefaultPrimary>, Simplify<RichTextSectionSliceDefaultItem>>;

/**
 * Slice variation for *RichTextSection*
 */
type RichTextSectionSliceVariation = RichTextSectionSliceDefault

/**
 * RichTextSection Shared Slice
 *
 * - **API ID**: `rich_text_section`
 * - **Description**: Heading + body text block, optionally with inline links
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type RichTextSectionSlice = prismic.SharedSlice<"rich_text_section", RichTextSectionSliceVariation>;

declare module "@prismicio/client" {
	interface CreateClient {
		(repositoryNameOrEndpoint: string, options?: prismic.ClientConfig): prismic.Client<AllDocumentTypes>;
	}
	
	interface CreateWriteClient {
		(repositoryNameOrEndpoint: string, options: prismic.WriteClientConfig): prismic.WriteClient<AllDocumentTypes>;
	}
	
	interface CreateMigration {
		(): prismic.Migration<AllDocumentTypes>;
	}
	
	namespace Content {
		export type {
			AppLabelsDocument,
			AppLabelsDocumentData,
			AuthNavDocument,
			AuthNavDocumentData,
			ContentPageDocument,
			ContentPageDocumentData,
			ContentPageDocumentDataHeadingSlice,
			ContentPageDocumentDataMainSlice,
			ContentPageDocumentDataAsideSlice,
			ContentPageDocumentDataFooterSlice,
			FooterDocument,
			FooterDocumentData,
			HeaderDocument,
			HeaderDocumentData,
			HomePageDocument,
			HomePageDocumentData,
			LoginFormDocument,
			LoginFormDocumentData,
			LoginPageDocument,
			LoginPageDocumentData,
			AllDocumentTypes,
			AccordionSlice,
			AccordionSliceDefaultItem,
			AccordionSliceVariation,
			AccordionSliceDefault,
			BreadcrumbsSlice,
			BreadcrumbsSliceDefaultPrimary,
			BreadcrumbsSliceVariation,
			BreadcrumbsSliceDefault,
			ButtonLinkSlice,
			ButtonLinkSliceDefaultPrimary,
			ButtonLinkSliceVariation,
			ButtonLinkSliceDefault,
			CalloutSlice,
			CalloutSliceDefaultPrimary,
			CalloutSliceVariation,
			CalloutSliceDefault,
			DisclosureListSlice,
			DisclosureListSliceDefaultPrimaryFilesItem,
			DisclosureListSliceDefaultPrimary,
			DisclosureListSliceVariation,
			DisclosureListSliceDefault,
			FaqAccordionSlice,
			FaqAccordionSliceDefaultPrimaryQaItem,
			FaqAccordionSliceDefaultPrimary,
			FaqAccordionSliceSidebarNavPrimaryLinksItem,
			FaqAccordionSliceSidebarNavPrimary,
			FaqAccordionSliceVariation,
			FaqAccordionSliceDefault,
			FaqAccordionSliceSidebarNav,
			FaqAnswerSwapSlice,
			FaqAnswerSwapSliceDefaultPrimary,
			FaqAnswerSwapSliceDefaultItem,
			FaqAnswerSwapSliceVariation,
			FaqAnswerSwapSliceDefault,
			FaqQuestionListSlice,
			FaqQuestionListSliceDefaultPrimary,
			FaqQuestionListSliceDefaultItem,
			FaqQuestionListSliceGridPrimary,
			FaqQuestionListSliceGridItem,
			FaqQuestionListSliceAccordionPrimary,
			FaqQuestionListSliceAccordionItem,
			FaqQuestionListSliceFooterGridPrimary,
			FaqQuestionListSliceFooterGridItem,
			FaqQuestionListSliceWithiconPrimary,
			FaqQuestionListSliceWithiconItem,
			FaqQuestionListSliceVariation,
			FaqQuestionListSliceDefault,
			FaqQuestionListSliceGrid,
			FaqQuestionListSliceAccordion,
			FaqQuestionListSliceFooterGrid,
			FaqQuestionListSliceWithicon,
			FileDownloadListSlice,
			FileDownloadListSliceDefaultItem,
			FileDownloadListSliceVariation,
			FileDownloadListSliceDefault,
			ImageBlockSlice,
			ImageBlockSliceDefaultPrimary,
			ImageBlockSliceVariation,
			ImageBlockSliceDefault,
			InfoCardListSlice,
			InfoCardListSliceDefaultItem,
			InfoCardListSliceVariation,
			InfoCardListSliceDefault,
			LinkListSlice,
			LinkListSliceDefaultPrimary,
			LinkListSliceDefaultItem,
			LinkListSliceVariation,
			LinkListSliceDefault,
			PageTitleSlice,
			PageTitleSliceDefaultPrimary,
			PageTitleSliceVariation,
			PageTitleSliceDefault,
			QuestionAnswerSliceSlice,
			QuestionAnswerSliceSliceDefaultPrimaryItemsItem,
			QuestionAnswerSliceSliceDefaultPrimary,
			QuestionAnswerSliceSliceVariation,
			QuestionAnswerSliceSliceDefault,
			QuestionListSliceSlice,
			QuestionListSliceSliceDefaultPrimaryQuestionsItem,
			QuestionListSliceSliceDefaultPrimary,
			QuestionListSliceSliceVariation,
			QuestionListSliceSliceDefault,
			RichTextSectionSlice,
			RichTextSectionSliceDefaultPrimary,
			RichTextSectionSliceDefaultItem,
			RichTextSectionSliceVariation,
			RichTextSectionSliceDefault
		}
	}
}