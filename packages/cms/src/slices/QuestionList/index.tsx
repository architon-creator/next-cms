"use client";

import type { Content } from "@prismicio/client";
import type { SliceComponentProps } from "@prismicio/react";
import { PrismicLink } from "@prismicio/react";
import type { FC } from "react";
import { useFaqTopic } from "../../lib/faq-topic-context";

export type QuestionListSliceProps = SliceComponentProps<Content.QuestionListSliceSlice>;

/**
 * Component for "QuestionListSlice" Slices.
 * Left-panel question list filtered by the shared `activeTopic` (see FaqTopicProvider).
 */
const QuestionListSlice: FC<QuestionListSliceProps> = ({ slice }) => {
  const { activeTopic } = useFaqTopic();
  const questions = slice.primary.questions ?? [];
  const visible = questions.filter((item) => item.topic === activeTopic);

  if (!visible.length) {
    return null;
  }

  const heading = visible[0]?.heading ?? "";

  return (
    <section
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
      className="question-list w-full"
      aria-live="polite"
    >
      {heading ? <h2 className="mb-6 font-bold text-2xl">{heading}</h2> : null}
      <ul className="flex flex-col gap-4">
        {visible.map((item) => (
          <li key={`${slice.id ?? "question"}-${item.question}`}>
            <PrismicLink
              field={item.question_link}
              className="text-base text-primary-700 hover:underline"
            >
              {item.question}
            </PrismicLink>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default QuestionListSlice;
