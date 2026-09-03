import React from "react";
import { Link } from "react-router-dom";

const CONTACT_EMAIL = "memeclassroom@gmail.com";
const LAST_UPDATED = "September 2026";

const Section = ({ title, children }) => (
  <section className="space-y-3">
    <h2 className="text-lg font-extrabold text-gray-900 dark:text-white border-b border-gray-200 dark:border-zinc-800 pb-2">
      {title}
    </h2>
    <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
      {children}
    </div>
  </section>
);

const TermsOfService = () => {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-10">
      {/* Header */}
      <div className="space-y-2">
        <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg">
          Legal
        </span>
        <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white mt-2">
          Terms of Service
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Last updated: {LAST_UPDATED}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          By using MemeClassroom, you agree to these Terms of Service. Please read them carefully.
          If you do not agree, please do not use the platform.
        </p>
      </div>

      {/* 1 */}
      <Section title="1. About MemeClassroom">
        <p>
          MemeClassroom is an open educational platform where teachers and students create, share, and discuss
          memes as learning tools. The platform is grounded in open pedagogy principles — learner voice,
          co-creation, and cultural relevance.
        </p>
        <p>
          MemeClassroom is a non-commercial project. We do not charge users for access to the core platform.
        </p>
      </Section>

      {/* 2 */}
      <Section title="2. Eligibility">
        <p>You may use MemeClassroom if you:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Are at least 13 years old (or the minimum age of digital consent in your country)</li>
          <li>Are using the platform in an educational context</li>
          <li>Agree to these Terms and our <Link to="/privacy" className="text-purple-600 dark:text-purple-400 hover:underline">Privacy Policy</Link></li>
        </ul>
        <p>
          Students under 13 may use the platform only under the direct supervision of a teacher or parent/guardian
          who holds the registered account.
        </p>
      </Section>

      {/* 3 */}
      <Section title="3. Your Account">
        <p>
          You are responsible for keeping your account credentials secure. Do not share your password.
          You are responsible for all activity that occurs under your account.
        </p>
        <p>
          You may not create accounts using someone else's identity or for the purpose of impersonation.
        </p>
      </Section>

      {/* 4 */}
      <Section title="4. Content You Post — License">
        <p>
          When you publish a meme, resource, comment, or other content on MemeClassroom, you grant MemeClassroom
          a non-exclusive, royalty-free licence to display, distribute, and promote that content within the platform.
        </p>
        <p>
          All user-published content on MemeClassroom is made available under the{" "}
          <strong>Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)</strong>{" "}
          licence, unless the content is marked otherwise.
        </p>
        <p>
          This means others may share and adapt your published content, provided they:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Give appropriate credit to you as the creator</li>
          <li>Do not use it for commercial purposes</li>
          <li>Share any adaptations under the same licence</li>
        </ul>
        <p>
          By publishing content, you confirm that you have the right to share it under this licence.
        </p>
      </Section>

      {/* 5 */}
      <Section title="5. Acceptable Use">
        <p>You agree not to use MemeClassroom to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Post content that is hateful, discriminatory, harassing, or abusive</li>
          <li>Post sexually explicit or age-inappropriate content</li>
          <li>Post content that infringes another person's copyright or intellectual property</li>
          <li>Impersonate any person or organisation</li>
          <li>Upload malicious files, scripts, or links</li>
          <li>Attempt to gain unauthorised access to other accounts or the platform infrastructure</li>
          <li>Use the platform for commercial promotion without permission</li>
          <li>Spam, flood, or disrupt the community</li>
        </ul>
        <p>
          Violations may result in content removal, account suspension, or a permanent ban.
        </p>
      </Section>

      {/* 6 */}
      <Section title="6. GIFs, Templates, and Third-Party Media">
        <p>
          The Meme Lab allows you to search for GIFs via Giphy and use meme templates. GIFs and templates may
          be subject to their own copyright restrictions. By using third-party media in your memes, you accept
          responsibility for ensuring you have the right to use and share that media.
        </p>
        <p>
          MemeClassroom provides GIF search as a convenience. We do not represent that all Giphy content is
          free for derivative use. When in doubt, use original content or content with confirmed open licences.
        </p>
      </Section>

      {/* 7 */}
      <Section title="7. AI-Generated Content">
        <p>
          The platform includes an AI-powered caption generator (using Google Gemini). AI-generated suggestions
          are provided as a creative aid. You are responsible for reviewing and editing AI output before
          publishing. MemeClassroom does not warrant the accuracy, appropriateness, or copyright status of
          AI-generated content.
        </p>
      </Section>

      {/* 8 */}
      <Section title="8. Moderation and Content Removal">
        <p>
          MemeClassroom administrators may review, edit, hide, or remove content that violates these Terms or
          community standards. We may notify you when we take action on your content.
        </p>
        <p>
          You may report content you believe violates these Terms using the flag/report function available on
          each piece of content.
        </p>
      </Section>

      {/* 9 */}
      <Section title="9. Disclaimers">
        <p>
          MemeClassroom is provided "as is" without warranties of any kind. We do not guarantee continuous,
          uninterrupted access. The platform may be updated, modified, or discontinued at any time.
        </p>
        <p>
          We are not liable for user-generated content posted on the platform. Content represents the views
          of individual users, not MemeClassroom.
        </p>
      </Section>

      {/* 10 */}
      <Section title="10. Open Source and Attributions">
        <p>
          MemeClassroom uses open-source software. Key attributions:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>FFmpeg</strong> — used for in-browser video processing. Licensed under the{" "}
            <a href="https://www.gnu.org/licenses/lgpl-2.1.html" target="_blank" rel="noopener noreferrer" className="text-purple-600 dark:text-purple-400 hover:underline">GNU Lesser General Public Licence (LGPL) 2.1 ↗</a>.
          </li>
          <li>
            <strong>React, Firebase, Tailwind CSS, Lucide, react-pdf, html2canvas, qrcode</strong> — used under their respective open-source licences (MIT, Apache 2.0).
          </li>
          <li>
            <strong>Fonts</strong>: Manrope, Instrument Serif, and Pacifico are served via Google Fonts under the SIL Open Font Licence.
          </li>
        </ul>
      </Section>

      {/* 11 */}
      <Section title="11. Changes to These Terms">
        <p>
          We may update these Terms from time to time. The "Last updated" date will reflect the most recent version.
          Continued use of MemeClassroom after changes are posted constitutes your acceptance of the updated Terms.
        </p>
      </Section>

      {/* 12 */}
      <Section title="12. Contact">
        <p>
          For questions about these Terms, contact us at:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-purple-600 dark:text-purple-400 hover:underline">{CONTACT_EMAIL}</a>
        </p>
      </Section>

      {/* Back link */}
      <div className="pt-4 border-t border-gray-200 dark:border-zinc-800 text-sm">
        <Link to="/" className="text-purple-600 dark:text-purple-400 hover:underline font-semibold">
          ← Back to MemeClassroom
        </Link>
        {" · "}
        <Link to="/privacy" className="text-purple-600 dark:text-purple-400 hover:underline font-semibold">
          Privacy Policy
        </Link>
      </div>
    </div>
  );
};

export default TermsOfService;
