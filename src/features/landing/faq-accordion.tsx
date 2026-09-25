"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

export type Faq = {
  question: string;
  answer: string;
};

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div>
      <h2>FAQs</h2>
      {faqs.map((faq, index) => {
        const isOpen = openIndex === index;
        return (
          <div className="landing-faq-item" data-open={isOpen} key={faq.question}>
            <button
              type="button"
              className="landing-faq-q"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? null : index)}
            >
              {faq.question}
              <span className="landing-faq-plus" aria-hidden="true">
                <Plus size={13} />
              </span>
            </button>
            <div className="landing-faq-a">{faq.answer}</div>
          </div>
        );
      })}
    </div>
  );
}
