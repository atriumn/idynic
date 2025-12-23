export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground">Last updated: December 21, 2025</p>

      <section>
        <h2>1. Information We Collect</h2>
        <p>
          We collect information you provide directly to us, such as when you create or modify your account, 
          upload a resume, or contact customer support. This information may include: name, email, employment history, 
          education, and skills.
        </p>
      </section>

      <section>
        <h2>2. How We Use Your Information</h2>
        <p>
          We use the information we collect to provide, maintain, and improve our services, including:
        </p>
        <ul>
            <li>Synthesizing your professional identity</li>
            <li>Generating tailored job application content</li>
            <li>Providing customer service</li>
            <li>Sending you technical notices and updates</li>
        </ul>
      </section>

      <section>
        <h2>3. Data Sharing</h2>
        <p>
          We do not share your personal information with third parties except as described in this policy. 
          We may share your information with third-party vendors and service providers that perform services on our behalf, 
          such as hosting and AI processing.
        </p>
      </section>

      <section>
        <h2>4. Data Security</h2>
        <p>
          We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, 
          disclosure, alteration and destruction.
        </p>
      </section>

       {/* Placeholder for real privacy policy */}
      <section className="bg-muted p-4 rounded-md border text-sm text-muted-foreground">
        <em>Note: This is a placeholder for the full Privacy Policy. In a production environment, this should be replaced with a legally binding document drafted by legal counsel.</em>
      </section>
    </div>
  );
}
