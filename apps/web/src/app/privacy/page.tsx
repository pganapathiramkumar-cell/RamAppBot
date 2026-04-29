export const metadata = {
  title: 'Privacy Policy — RamVector',
  description: 'How RamVector collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <main style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', maxWidth: 760, margin: '40px auto', padding: '0 24px', color: '#1e293b', lineHeight: 1.7 }}>
      <h1 style={{ color: '#0f172a', fontSize: 28, marginBottom: 4 }}>Privacy Policy</h1>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 32 }}>RamVector &mdash; Last updated: April 29, 2026</p>

      <p style={{ color: '#475569', fontSize: 15 }}>
        RamVector (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is committed to protecting your privacy.
        This policy explains what data the RamVector mobile app collects, how it is used, and who it is shared with.
      </p>

      <Section title="1. Data We Collect">
        <ul>
          <li><strong>PDF document content</strong> &mdash; the text extracted from PDFs you upload.</li>
          <li><strong>Document metadata</strong> &mdash; filename and file size.</li>
          <li><strong>Consent record</strong> &mdash; a session flag indicating you accepted this policy (stored on-device only).</li>
        </ul>
        <p>We do <strong>not</strong> collect your name, email address, location, device identifiers, or any other personal information.</p>
      </Section>

      <Section title="2. How We Use Your Data">
        <p>Uploaded PDF text is used solely to generate:</p>
        <ul>
          <li>An AI-produced executive summary</li>
          <li>Structured action points and key entities</li>
          <li>A workflow diagram</li>
        </ul>
        <p>Results are returned to you in the app and are not used for advertising, profiling, or any other purpose.</p>
      </Section>

      <Section title="3. Third-Party AI Service — Groq, Inc.">
        <div style={{ background: '#f0f9ff', borderLeft: '3px solid #2563eb', padding: '14px 18px', borderRadius: 4, margin: '16px 0' }}>
          <p style={{ color: '#475569', fontSize: 15, margin: 0 }}>
            <strong>Your PDF text content is transmitted to Groq, Inc.</strong> (groq.com), a third-party AI service,
            to perform the analysis described above. Groq processes this data on our behalf under their own{' '}
            <a href="https://groq.com/privacy-policy/" style={{ color: '#2563eb' }}>Privacy Policy</a>.
          </p>
          <p style={{ color: '#475569', fontSize: 15, marginBottom: 0, marginTop: 10 }}>
            By using RamVector and accepting this policy in the app, you consent to your document text being sent to Groq for processing.
          </p>
        </div>
        <p style={{ color: '#475569', fontSize: 15 }}>We do not sell, rent, or share your data with any other third parties.</p>
      </Section>

      <Section title="4. Data Retention">
        <ul>
          <li>Documents are processed in memory and are <strong>not stored permanently</strong> on our servers.</li>
          <li>Analysis results are held temporarily in server memory and are lost when the service restarts.</li>
          <li>Groq&apos;s data retention is governed by <a href="https://groq.com/privacy-policy/" style={{ color: '#2563eb' }}>Groq&apos;s Privacy Policy</a>.</li>
        </ul>
      </Section>

      <Section title="5. Data Security">
        <p>All data is transmitted over HTTPS (TLS). We do not log or store the content of your documents beyond the time needed to complete the analysis.</p>
      </Section>

      <Section title="6. Children's Privacy">
        <p>RamVector is not directed at children under 13. We do not knowingly collect data from children.</p>
      </Section>

      <Section title="7. Your Rights">
        <p>Because we do not store personal data permanently, there is no persistent record to delete. You can withdraw consent at any time by uninstalling the app.</p>
      </Section>

      <Section title="8. Contact Us">
        <p>Questions about this policy? Contact us at: <a href="mailto:ramgigatech@gmail.com" style={{ color: '#2563eb' }}>ramgigatech@gmail.com</a></p>
      </Section>

      <Section title="9. Changes to This Policy">
        <p>We may update this policy from time to time. The &ldquo;last updated&rdquo; date at the top will reflect any changes. Continued use of the app after changes constitutes acceptance of the revised policy.</p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ color: '#0f172a', fontSize: 18, marginTop: 36, borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>{title}</h2>
      {children}
    </section>
  );
}
