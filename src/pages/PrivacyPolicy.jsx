import React from "react";
import { Link } from "react-router-dom";

const CONTACT_EMAIL = "memeclassroom@gmail.com";
const LAST_UPDATED = "September 2026";

const Section = ({ id, title, children }) => (
  <section id={id} className="space-y-3 scroll-mt-24">
    <h2 className="text-lg md:text-xl font-extrabold text-gray-900 dark:text-white border-b border-gray-200 dark:border-zinc-800 pb-2">
      {title}
    </h2>
    <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
      {children}
    </div>
  </section>
);

const PrivacyPolicy = () => {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-10">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg">
            Privacy Policy
          </span>
          <span className="bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg">
            DPDPA 2023 & GDPR Aligned
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
          Privacy Policy
        </h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Last updated: {LAST_UPDATED} · Transparent Educational Data Standards
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-purple-50/50 dark:bg-zinc-900/50 border border-purple-100 dark:border-zinc-800 p-4 rounded-xl">
          At <strong>MemeClassroom</strong> ("we", "our", or "the platform"), we are committed to protecting the privacy
          and digital safety of educators, students, and academic researchers. This Privacy Policy details how we collect,
          use, secure, and disclose information when you access our Open Educational Resource (OER) platform.
        </p>

        {/* Quick Jump Anchors */}
        <div className="pt-2 flex flex-wrap gap-2 text-xs">
          <span className="text-gray-400 font-bold self-center">Quick links:</span>
          <a href="#collect" className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-purple-50 dark:hover:bg-purple-950/40">2. Information Collected</a>
          <a href="#verification" className="px-2.5 py-1 rounded-md bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 font-bold hover:bg-indigo-200">3. School & ID Verification</a>
          <a href="#financial" className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-purple-50 dark:hover:bg-purple-950/40">4. Donations & Payments</a>
          <a href="#ads" className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-purple-50 dark:hover:bg-purple-950/40">5. Advertisements</a>
          <a href="#students" className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-purple-50 dark:hover:bg-purple-950/40">6. Student Privacy</a>
          <a href="#rights" className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-purple-50 dark:hover:bg-purple-950/40">9. Data Rights</a>
        </div>
      </div>

      {/* 1. Who We Are */}
      <Section id="who-we-are" title="1. Who We Are & Our Privacy Commitment">
        <p>
          MemeClassroom is an educational platform dedicated to meme pedagogy, multimodal learning, and media literacy.
          We operate on a <strong>Privacy-by-Design</strong> principle. We do not sell, broker, or rent your personal information.
          Any data collected is strictly necessary to deliver educational features, maintain a safe academic community,
          and verify educator credentials.
        </p>
        <p>
          Data Controller & Inquiries:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </Section>

      {/* 2. Information We Collect */}
      <Section id="collect" title="2. Information We Collect & Why">
        <p>We collect only minimal, purpose-specific information necessary for educational functionality:</p>
        
        <div className="space-y-3">
          <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700">
            <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider mb-1">
              A. Information Provided Upon Registration
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li><strong>Full Name / Display Name:</strong> Displayed on published memes, lesson contributions, and discussion posts.</li>
              <li><strong>Email Address:</strong> Used strictly for authentication, account recovery, and critical platform notifications. Never displayed publicly.</li>
              <li><strong>Password:</strong> Handled securely via Firebase Authentication with industry-standard cryptographic hashing and salting. We never see or store raw passwords.</li>
              <li><strong>Role (Student / Teacher / Expert):</strong> Used to provide role-appropriate access control (e.g. lesson planning tools, expert commentary).</li>
              <li><strong>School / College / Organization Name:</strong> Enables curriculum-aligned filtering and academic relevance.</li>
              <li><strong>General Geographic Location (City/Place, State, Country):</strong> Self-reported for local curriculum context. Precise GPS location is never tracked.</li>
              <li><strong>Profile Avatar:</strong> Selected from preset illustrations or custom uploaded photo.</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700">
            <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider mb-1">
              B. Educational Platform Activity
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>Memes created, published, or saved as drafts.</li>
              <li>Comments and replies in the Staffroom community.</li>
              <li>Educational articles, lesson activities, or research papers submitted to Meme Reads.</li>
              <li>Meme literacy test responses, scores, and achievement badges.</li>
              <li>Content ratings, bookmarks, and reported/flagged content.</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700">
            <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider mb-1">
              C. Client-Only Data (Never Transmitted to Our Servers)
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li><strong>Accessibility Preferences (UDL):</strong> High contrast mode and font-size adjustments are stored strictly in your browser's local storage.</li>
              <li><strong>Personal Gemini AI API Key:</strong> If you enter a custom Gemini AI key for caption generation, it remains in your browser session and is never sent to or stored on MemeClassroom servers.</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* 3. School Details & ID Card Verification */}
      <Section id="verification" title="3. School Details and Institutional ID Card Verification">
        <div className="p-4 rounded-xl bg-indigo-55/30 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/60 space-y-2">
          <p className="font-bold text-indigo-900 dark:text-indigo-200 text-sm flex items-center gap-1.5">
            <span>🔒</span> Strict Protection of Educator Verification Credentials:
          </p>
          <p className="text-xs text-indigo-900/90 dark:text-indigo-200/90 leading-relaxed">
            MemeClassroom is a student-centered educational space. To prevent unauthorized adults or bad actors from
            impersonating verified faculty members, educators applying for "Teacher" or "Expert" status may optionally
            submit an institutional ID card or school credential document.
          </p>
        </div>

        <ul className="list-disc pl-5 space-y-2 text-xs">
          <li>
            <strong>Purpose Limitation:</strong> Institutional ID cards are used <em>exclusively</em> to confirm that an applicant is a legitimate educator affiliated with a recognized school, college, or academic institution.
          </li>
          <li>
            <strong>Isolated & Restricted Storage:</strong> ID card files are uploaded directly to private, access-restricted Firebase Cloud Storage (<code className="bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded">id_cards/{'{userId}'}_id</code>). Backend security rules block all public and client-side read requests.
          </li>
          <li>
            <strong>Strict Access Control:</strong> Only appointed platform administrators with verified security clearance can inspect ID documents during the verification review. Other users, teachers, students, or visitors can never view your ID card.
          </li>
          <li>
            <strong>No Indexing or Sharing:</strong> ID cards are never indexed by web crawlers, never shared with third parties or advertisers, and never used for automated algorithmic profiling.
          </li>
          <li>
            <strong>Permanent Erasure on Request:</strong> Once verification is complete, or at any time upon request, you may email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-purple-600 dark:text-purple-400 font-bold hover:underline">
              {CONTACT_EMAIL}
            </a>{" "}
            to have your uploaded ID document permanently purged from our storage.
          </li>
        </ul>
      </Section>

      {/* 4. Financial Privacy: Donations & Payment Processors */}
      <Section id="financial" title="4. Donations, Payments & Financial Privacy">
        <p>
          MemeClassroom accepts voluntary community donations to cover server hosting bandwidth, database operations,
          and Google Gemini AI API compute costs.
        </p>
        <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 text-xs space-y-2">
          <p>
            <strong>PCI-DSS Certified Payment Gateways:</strong> When you make a voluntary donation via PayPal, Razorpay,
            UPI, or Stripe, all payment details (such as credit/debit card numbers, UPI PINs, or bank account information)
            are collected and processed directly by the respective payment gateway.
          </p>
          <p>
            <strong>Zero Financial Data Stored:</strong> MemeClassroom <strong>never</strong> views, captures, or stores
            credit card numbers, CVVs, or bank credentials on our servers. We receive only transaction confirmations
            (e.g., transaction ID, amount, and timestamp) for record-keeping and audit compliance.
          </p>
        </div>
      </Section>

      {/* 5. Advertisements & Third-Party Networks */}
      <Section id="ads" title="5. Advertisements & Third-Party Ad Networks">
        <p>
          To maintain free public access to our educational tools without charging subscription fees, MemeClassroom may
          display non-intrusive contextual advertising (such as Google AdSense or ethical education sponsor messages).
        </p>
        <div className="space-y-2 text-xs">
          <p>
            <strong>Ad Serving & Cookies:</strong> Third-party ad vendors, including Google, use cookies and web beacons
            to serve ads based on a user's prior visits to this website or other websites. Google's use of advertising cookies
            enables it and its partners to serve relevant ads based on visits to educational or web resources.
          </p>
          <p>
            <strong>Opt-Out of Personalized Advertising:</strong> Users may opt out of personalized advertising by visiting{" "}
            <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 dark:text-purple-400 font-bold hover:underline">
              Google Ads Settings ↗
            </a>{" "}
            or by visiting the{" "}
            <a href="https://optout.aboutads.info/" target="_blank" rel="noopener noreferrer" className="text-purple-600 dark:text-purple-400 font-bold hover:underline">
              AboutAds Consumer Opt-Out Page ↗
            </a>.
          </p>
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60">
            <p className="font-bold text-emerald-900 dark:text-emerald-200">
              🛡️ Student Privacy Shield:
            </p>
            <p className="text-emerald-900/90 dark:text-emerald-200/90 mt-0.5">
              We enforce strict data partitioning: student educational records, classroom assignments, school affiliations,
              and verification ID cards are <strong>never</strong> shared with, sold to, or accessible by advertising partners.
            </p>
          </div>
        </div>
      </Section>

      {/* 6. Children's & Student Privacy */}
      <Section id="students" title="6. Children's & Student Privacy (DPDPA 2023, COPPA & GDPR-K)">
        <p>
          MemeClassroom is built for educational institutions. We implement comprehensive student safety safeguards
          compliant with Section 9 of the Indian <strong>Digital Personal Data Protection Act, 2023 (DPDPA)</strong>, the U.S.{" "}
          <strong>COPPA / FERPA</strong> principles, and European <strong>GDPR-K</strong> standards:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li><strong>Institutional / Parental Supervision:</strong> Students under the legal age of digital consent (18 in India under DPDPA, 13 in the US under COPPA, 16 in the EU) may use the platform only with educational oversight from their school, verified teacher, or legal guardian.</li>
          <li><strong>Confidentiality of Student Details:</strong> Student email addresses and school affiliations are shielded from public view. Only display names and earned literacy badges are visible to signed-in peers.</li>
          <li><strong>No Behavioral Tracking of Children:</strong> We strictly prohibit behavioral ad targeting, tracking, or profiling directed at minors.</li>
        </ul>
      </Section>

      {/* 7. Third-Party Service Providers */}
      <Section id="third-parties" title="7. Third-Party Infrastructure & Technical Services">
        <p>We work with trusted cloud infrastructure providers bound by rigorous data confidentiality agreements:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs">
          <li><strong>Firebase / Google Cloud:</strong> Authentication, Firestore database, and Cloud Storage. Encrypted in transit (TLS/HTTPS) and at rest.</li>
          <li><strong>Google Gemini API:</strong> Generative meme captioning. Only the immediate creative prompt and template context are sent; personal profile identifiers are never passed into AI models.</li>
          <li><strong>Giphy API:</strong> Real-time GIF search in the Meme Lab. Search terms are transmitted directly to Giphy; no personal account data is shared.</li>
        </ul>
      </Section>

      {/* 8. Data Retention & Security */}
      <Section id="retention" title="8. Data Retention & Security Measures">
        <p>
          We employ multi-layered administrative, technical, and physical safeguards to protect user information:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li>Account data is retained as long as your account remains active.</li>
          <li>If an account is deleted, personal profile data and institutional ID credentials are removed immediately. Published educational memes remain credited under an anonymized author label to preserve pedagogical continuity under CC BY-NC-SA 4.0.</li>
          <li>Cloud communications are encrypted using modern Transport Layer Security (TLS 1.3).</li>
        </ul>
      </Section>

      {/* 9. Your Rights as a Data Principal */}
      <Section id="rights" title="9. Your Rights as a Data Principal (Users)">
        <p>Under India's DPDPA 2023, the European GDPR, and international data privacy laws, you possess the rights to:</p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li><strong>Access:</strong> Request a summary of the personal data we hold about you.</li>
          <li><strong>Correction:</strong> Update, correct, or complete inaccurate institutional or profile details directly from your Profile settings.</li>
          <li><strong>Erasure ("Right to be Forgotten"):</strong> Request permanent deletion of your account, profile data, or verification ID documents.</li>
          <li><strong>Withdraw Consent:</strong> Close your account at any time without penalty.</li>
          <li><strong>Grievance Redressal:</strong> Submit inquiries or complaints to our designated Grievance Officer.</li>
        </ul>
        <p className="text-xs pt-1">
          To exercise any of these rights, contact us at:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-purple-600 dark:text-purple-400 font-bold hover:underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </Section>

      {/* 10. Grievance Redressal Officer */}
      <Section id="grievance" title="10. Grievance Redressal Officer (DPDPA 2023 & IT Rules 2021)">
        <p>
          For any data privacy inquiries, complaints, or document deletion requests, please contact our designated
          Grievance Officer:
        </p>
        <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 text-xs space-y-1">
          <p><strong>Designation:</strong> Data Protection & Grievance Redressal Officer</p>
          <p><strong>Platform:</strong> MemeClassroom Open Educational Platform</p>
          <p><strong>Email:</strong> <a href={`mailto:${CONTACT_EMAIL}`} className="text-purple-600 dark:text-purple-400 hover:underline">{CONTACT_EMAIL}</a></p>
          <p><strong>Turnaround:</strong> All data privacy requests and grievances are responded to within <strong>24 to 72 hours</strong>, and resolved within 15 days.</p>
        </div>
      </Section>

      {/* 11. Policy Updates */}
      <Section id="updates" title="11. Modifications to This Policy">
        <p>
          We may update this Privacy Policy from time to time to adapt to new educational features or statutory updates.
          The revised "Last updated" date will always be visible at the top of this document. Continued use of MemeClassroom
          signifies your acknowledgment of any revised terms.
        </p>
      </Section>

      {/* Footer Navigation */}
      <div className="pt-6 border-t border-gray-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <Link to="/" className="text-purple-600 dark:text-purple-400 hover:underline font-bold">
          ← Return to MemeClassroom Home
        </Link>
        <div className="space-x-3">
          <Link to="/terms" className="text-purple-600 dark:text-purple-400 hover:underline font-bold">
            Terms of Service →
          </Link>
          <Link to="/about" className="text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition">
            Pedagogical Framework
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
