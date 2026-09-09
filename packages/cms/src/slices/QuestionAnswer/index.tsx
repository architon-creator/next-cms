"use client";

import type { Content } from "@prismicio/client";
import type { SliceComponentProps } from "@prismicio/react";
import { PrismicLink, PrismicRichText } from "@prismicio/react";
import type { FC } from "react";
import { useFaqTopic } from "../../lib/faq-topic-context";

export type QuestionAnswerSliceProps = SliceComponentProps<Content.QuestionAnswerSliceSlice>;

/**
 * Component for "QuestionAnswerSlice" Slices.
 * Left-panel single Q&A + related questions, filtered by the shared `activeTopic`.
 */
const QuestionAnswerSlice: FC<QuestionAnswerSliceProps> = ({ slice }) => {
  const { activeTopic } = useFaqTopic();
  const items = slice.primary.items ?? [];
  const visible = items.filter((item) => item.topic === activeTopic);

  if (!visible.length) {
    return null;
  }

  const [main, ...related] = visible;

  return (
    <section
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
      className="question-answer w-full"
      aria-live="polite"
    >
      <h2 className="mb-4 font-bold text-2xl">{main.question}</h2>
      <div className="prose mb-8">
        <PrismicRichText field={main.answer} />
      </div>
      {related.length > 0 ? (
        <div className="related-questions border-t pt-6">
          <h3 className="mb-3 font-semibold">Related Questions</h3>
          <ul className="flex flex-col gap-2">
            {related.map((item) => (
              <li key={`${slice.id ?? "related"}-${item.related_question_label}`}>
                <PrismicLink
                  field={item.related_question_link}
                  className="text-primary-700 hover:underline"
                >
                  {item.related_question_label}
                </PrismicLink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};

export default QuestionAnswerSlice;
