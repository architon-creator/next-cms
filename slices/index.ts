import Accordion from "./Accordion";
import Breadcrumbs from "./Breadcrumbs";
import ButtonLink from "./ButtonLink";
import Callout from "./Callout";
import DisclosureList from "./DisclosureList";
import FaqAnswerSwap from "./FaqAnswerSwap";
import FaqQuestionList from "./FaqQuestionList";
import FileDownloadList from "./FileDownloadList";
import ImageBlock from "./ImageBlock";
import InfoCardList from "./InfoCardList";
import LinkList from "./LinkList";
import PageTitle from "./PageTitle";
import RichTextSection from "./RichTextSection";

export type PageContext = {
  breadcrumbs: { label: string | null; href: string | null }[];
};

export const components = {
  accordion: Accordion,
  breadcrumbs: Breadcrumbs,
  button_link: ButtonLink,
  callout: Callout,
  disclosure_list: DisclosureList,
  faq_answer_swap: FaqAnswerSwap,
  faq_question_list: FaqQuestionList,
  file_download_list: FileDownloadList,
  image_block: ImageBlock,
  info_card_list: InfoCardList,
  link_list: LinkList,
  page_title: PageTitle,
  rich_text_section: RichTextSection,
};
