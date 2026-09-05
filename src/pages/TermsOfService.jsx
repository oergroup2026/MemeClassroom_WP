import React from "react";
import { Link } from "react-router-dom";

const CONTACT_EMAIL = "memeclassroom@gmail.com";
const LAST_UPDATED = "September 2026";

const Section = ({ id, title, children }) => (
  <section id={id} className="space-y-3 scroll-mt-24">
    <h2 className="text-lg md:text-xl font-extrabold text-gray-900 dark:text-white border-b border-gray-200 dark:border-zinc-800 pb-2 flex items-center justify-between">
      <span>{title}</span>
    </h2>
    <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
      {children}
    </div>
  </section>
);

const TermsOfService = () => {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-10">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg">
            Legal Agreement
          </span>
          <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg">
            Open Educational Resource (OER)
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
          Terms of Service
        </h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Last updated: {LAST_UPDATED} · Effective for all users globally
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-purple-50/50 dark:bg-zinc-900/50 border border-purple-100 dark:border-zinc-800 p-4 rounded-xl">
          Welcome to <strong>MemeClassroom</strong>. By accessing or using our website, services, or tools, you agree
          to be bound by these Terms of Service and our{" "}
          <Link to="/privacy" className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">
            Privacy Policy
          </Link>
          . If you do not agree with these terms, please do not access or use the platform.
        </p>

        {/* Quick Jump Anchors */}
        <div className="pt-2 flex flex-wrap gap-2 text-xs">
          <span className="text-gray-400 font-bold self-center">Quick links:</span>
          <a href="#about" className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-purple-50 dark:hover:bg-purple-950/40">1. About & OER</a>
          <a href="#sustainability" className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-purple-50 dark:hover:bg-purple-950/40">2. Sustainability, Donations & Ads</a>
          <a href="#fair-use" className="px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold hover:bg-amber-200">3. Fair Dealing & Fair Use</a>
          <a href="#licensing" className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-purple-50 dark:hover:bg-purple-950/40">4. CC BY-NC-SA Licensing</a>
          <a href="#accounts" className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-purple-50 dark:hover:bg-purple-950/40">5. School Details & ID Verification</a>
          <a href="#grievance" className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-purple-50 dark:hover:bg-purple-950/40">10. Grievance Officer</a>
        </div>
      </div>

      {/* 1. About & OER Mandate */}
      <Section id="about" title="1. About MemeClassroom & OER Mandate">
        <p>
          MemeClassroom is an educational platform dedicated to advancing <strong>Meme Pedagogy</strong>, visual literacy,
          multimodal communication, and critical thinking. The platform is designed as an <strong>Open Educational Resource (OER)</strong> initiative,
          aligned with the <em>UNESCO 2019 Recommendation on Open Educational Resources</em>.
        </p>
        <p>
          Our mission is to empower teachers, students, and academic researchers to create, adapt, and share contextual
          learning aids without commercial barriers. Access to our core educational creation tools, Meme Library, and
          pedagogical repository is free for all registered and guest educators.
        </p>
      </Section>

      {/* 2. Platform Sustainability: Donations & Advertisements */}
      <Section id="sustainability" title="2. Platform Sustainability — Free Core Access, Voluntary Donations & Advertisements">
        <p>
          To keep MemeClassroom freely available to schools, educators, and students without paywalling educational content,
          our infrastructure is sustained through a community-supported cost-recovery model:
        </p>
        <div className="space-y-2 pl-2">
          <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700">
            <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider mb-1">
              A. Voluntary Donations & Contributions
            </h3>
            <p>
              MemeClassroom welcomes voluntary donations from individuals, schools, foundations, and community supporters
              via certified payment gateways (e.g., PayPal, Razorpay, UPI, or Stripe). Donations are voluntary gifts solely
              allocated to cover hosting bandwidth, Firebase database storage, Google Gemini AI API compute quotas, and open-source
              development. Donations are non-refundable, non-commercial, and do not confer any equity, proprietary rights, or
              preferential editorial/moderation treatment.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700">
            <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider mb-1">
              B. Ethical Advertisements & Sponsored Educational Resources
            </h3>
            <p>
              The platform may display non-intrusive contextual advertising (such as Google AdSense banners or ethical
              educational sponsor messages) to help offset recurring infrastructure costs. All advertisements are subject to
              educational decorum standards:
            </p>
            <ul className="list-disc pl-5 mt-1.5 space-y-1 text-xs">
              <li>Advertisements must be appropriate for school, college, and family audiences. Adult content, gambling, predatory financial services, and harmful products are strictly prohibited.</li>
              <li>Advertisements do not constitute an endorsement, guarantee, or recommendation by MemeClassroom. We are not responsible for the content, privacy policies, or services of third-party advertisers.</li>
              <li>Personal educational records, student details, school affiliations, and verification ID cards are <strong>never</strong> shared or sold to advertising networks.</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* 3. Fair Dealing & Fair Use */}
      <Section id="fair-use" title="3. Educational Fair Dealing & Fair Use of Internet Memes and Third-Party Resources">
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-2">
          <p className="font-bold text-amber-900 dark:text-amber-200">
            ⚠️ Statutory Notice on Educational Use of Internet Memes & Media:
          </p>
          <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
            MemeClassroom facilitates the educational analysis, commentary, parody, and teaching of cultural artifacts.
            Third-party media, including popular internet meme templates, stills, GIFs (via Giphy API), and pop-culture
            imagery, are incorporated strictly under non-profit educational copyright exceptions.
          </p>
        </div>

        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Under Indian Law — Section 52 of the Indian Copyright Act, 1957:</strong> Specifically pursuant to{" "}
            <strong>Section 52(1)(a)</strong> (fair dealing for research, private study, criticism, or review) and{" "}
            <strong>Section 52(1)(i)</strong> (the reproduction of any work by a teacher or a pupil in the course of instruction
            or as part of educational assessment), the inclusion and transformative annotation of memes for classroom pedagogy
            does not constitute copyright infringement.
          </li>
          <li>
            <strong>Under United States Law — 17 U.S.C. § 107 (Fair Use Doctrine):</strong> Transformative commentary,
            teaching, scholarship, and media literacy analysis of cultural memes qualify as non-infringing Fair Use.
          </li>
          <li>
            <strong>Under International & EU Law:</strong> Uses are grounded in Article 5 of Directive (EU) 2019/790
            (digital use of works for teaching and educational purposes, criticism, review, and parody/caricature) and
            reciprocal provisions under the Berne Convention.
          </li>
          <li>
            <strong>Disclaimer of Non-Ownership:</strong> MemeClassroom claims no ownership, trademark, or copyright
            over third-party images, characters, viral meme templates, or brand logos uploaded or linked by users. All original
            copyrights remain with their respective intellectual property owners.
          </li>
        </ul>

        <div className="mt-3 p-3 rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1">
          <h4 className="font-bold text-xs uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Notice & Takedown Procedure (DMCA / IT Intermediary Compliance)
          </h4>
          <p className="text-xs">
            If you are a copyright owner or legal representative and believe that any content hosted on MemeClassroom
            exceeds fair educational use or infringes your rights, please submit an infringement notice to:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-purple-600 dark:text-purple-400 hover:underline">
              {CONTACT_EMAIL}
            </a>. Please include the URL/identification of the work, proof of ownership, and your contact details.
            Our administrative team will review and respond within <strong>36 to 72 hours</strong>.
          </p>
        </div>
      </Section>

      {/* 4. Creative Commons Licensing */}
      <Section id="licensing" title="4. User-Created Content — Creative Commons Licensing (CC BY-NC-SA 4.0)">
        <p>
          Except where third-party fair use materials are referenced, all original educational lesson plans,
          stories, activity guides, and original meme compilations published to MemeClassroom are made available
          under the:
        </p>
        <p className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 font-bold text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800/60">
          Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)
        </p>
        <p>This license grants other teachers and learners worldwide the rights to:</p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li><strong>Share:</strong> Copy and redistribute the material in any medium or format.</li>
          <li><strong>Adapt:</strong> Remix, transform, and build upon the material for educational purposes.</li>
        </ul>
        <p>Under the following core conditions:</p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li><strong>Attribution:</strong> You must give appropriate credit to the original creator.</li>
          <li><strong>Non-Commercial:</strong> You may not use the materials for commercial exploitation or sale.</li>
          <li><strong>Share-Alike:</strong> If you remix or transform the material, you must distribute your contributions under the exact same license.</li>
        </ul>
      </Section>

      {/* 5. Account Registration, School Details & ID Verification */}
      <Section id="accounts" title="5. Account Registration, School Details & Educator Verification">
        <p>
          To maintain a safe, responsible educational space, users must provide accurate and verifiable account information:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Eligibility:</strong> Users must be at least 13 years old (or the applicable digital age of consent in your jurisdiction). Students under this age must access the platform under the direct supervision of a verified teacher, school, or legal guardian.</li>
          <li><strong>School & Institutional Information:</strong> When registering, users provide their school, college, university, or educational organization name and role (Student, Teacher, or Subject Expert). This ensures curriculum-aligned filtering and academic relevance.</li>
          <li><strong>Teacher & Expert ID Card Verification:</strong>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
              <li>Educators applying for verified "Teacher" or "Expert" status may optionally submit an institutional ID card or official faculty proof.</li>
              <li><strong>Strict Purpose Limitation:</strong> ID cards are collected <em>solely</em> to verify educator credentials and protect students from unauthorized adult interactions.</li>
              <li><strong>Security & Isolation:</strong> Uploaded ID cards are stored in private, access-restricted Firebase Storage. Client reads are blocked by backend security rules. ID cards are never published, shared with other users, indexed by search engines, or made public.</li>
              <li><strong>Deletion on Request:</strong> Once verification is complete, or at any time upon request, you may request permanent deletion of your ID document by emailing {CONTACT_EMAIL}.</li>
            </ul>
          </li>
        </ul>
      </Section>

      {/* 6. Acceptable Academic Conduct */}
      <Section id="conduct" title="6. Academic Code of Conduct & Community Guidelines">
        <p>
          In accordance with Rule 3(1)(b) of the Information Technology (Intermediary Guidelines) Rules, 2021, and global
          educational standards, you agree not to post, share, or upload content that:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li>Is defamatory, obscene, pornographic, pedophilic, or sexually explicit.</li>
          <li>Promotes hate speech, discrimination, harassment, religious hostility, or cyberbullying against any student, teacher, or community.</li>
          <li>Infringes any patent, trademark, copyright, or proprietary rights.</li>
          <li>Contains software viruses, malicious scripts, spam, or disruptive code.</li>
          <li>Engages in academic dishonesty, plagiarism, or impersonation of educational institutions or faculty members.</li>
        </ul>
        <p>
          Violations will result in immediate content removal, disciplinary notification to the school where appropriate,
          account suspension, or permanent banning.
        </p>
      </Section>

      {/* 7. AI-Generated Content */}
      <Section id="ai-tools" title="7. AI Meme Generation & Pedagogical Scaffolding">
        <p>
          MemeClassroom includes AI caption generation powered by Google Gemini API. AI-generated text and suggestions
          are provided solely as creative and pedagogical aids. Users remain strictly responsible for reviewing, editing,
          and verifying all AI outputs for factual accuracy, cultural sensitivity, and age-appropriateness before publishing.
        </p>
      </Section>

      {/* 8. Content Moderation */}
      <Section id="moderation" title="8. Content Moderation & Flagging">
        <p>
          MemeClassroom provides a community flagging system allowing any registered user to report content that violates
          community standards. Platform administrators reserve the right to review, edit, unpublish, or permanently delete
          any meme, discussion post, or resource, without prior notice.
        </p>
      </Section>

      {/* 9. Disclaimers & Limitation of Liability */}
      <Section id="liability" title="9. Disclaimers & Limitation of Liability">
        <p>
          MemeClassroom is provided on an "as is" and "as available" educational basis without warranties of any kind,
          express or implied. We do not warrant that the platform will be uninterrupted, error-free, or entirely free
          of harmful components.
        </p>
        <p>
          To the maximum extent permitted by applicable law, MemeClassroom, its operators, contributors, and academic partners
          shall not be liable for any direct, indirect, incidental, or consequential damages resulting from the use or inability
          to use the platform, including third-party meme content or educational outcomes.
        </p>
      </Section>

      {/* 10. Grievance Redressal Officer */}
      <Section id="grievance" title="10. Grievance Redressal Mechanism (IT Rules, 2021)">
        <p>
          In accordance with the Information Technology Act, 2000, and rules made thereunder, any user grievances regarding
          platform content, terms, or data processing may be addressed to our designated Grievance Officer:
        </p>
        <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 text-xs space-y-1">
          <p><strong>Designation:</strong> Grievance Redressal Officer, MemeClassroom</p>
          <p><strong>Email:</strong> <a href={`mailto:${CONTACT_EMAIL}`} className="text-purple-600 dark:text-purple-400 hover:underline">{CONTACT_EMAIL}</a></p>
          <p><strong>Acknowledgement:</strong> Grievance complaints are acknowledged within 24 hours and addressed within 15 days as prescribed under applicable regulations.</p>
        </div>
      </Section>

      {/* 11. Governing Law & Jurisdiction */}
      <Section id="governing-law" title="11. Governing Law & Jurisdiction">
        <p>
          These Terms of Service are governed by and construed in accordance with the laws of the <strong>Republic of India</strong>.
          Any legal dispute or claim arising under these terms shall be subject to the exclusive jurisdiction of the competent courts
          located in India. For users accessing the platform internationally, mandatory local consumer protection provisions
          shall remain applicable as required by law.
        </p>
      </Section>

      {/* 12. Changes & Contact */}
      <Section id="contact" title="12. Changes to These Terms & Contact">
        <p>
          We may revise these Terms of Service periodically to reflect pedagogical enhancements or legislative updates.
          Continued use of MemeClassroom following the posting of modifications constitutes your acceptance of the updated terms.
        </p>
        <p>
          For general inquiries regarding these Terms, contact:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-purple-600 dark:text-purple-400 font-bold hover:underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </Section>

      {/* Footer Navigation */}
      <div className="pt-6 border-t border-gray-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <Link to="/" className="text-purple-600 dark:text-purple-400 hover:underline font-bold">
          ← Return to MemeClassroom Home
        </Link>
        <div className="space-x-3">
          <Link to="/privacy" className="text-purple-600 dark:text-purple-400 hover:underline font-bold">
            Privacy Policy →
          </Link>
          <Link to="/about" className="text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition">
            Pedagogical Framework
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
