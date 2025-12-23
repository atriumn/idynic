export default function TermsPage() {
  return (
    <div className="space-y-6">
      <h1>Terms of Service</h1>
      <p className="text-muted-foreground">Last updated: December 21, 2025</p>

      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using the Idynic service (&quot;Service&quot;), you agree to be bound by these Terms of Service. 
          If you do not agree to these terms, please do not use the Service.
        </p>
      </section>

      <section>
        <h2>2. Description of Service</h2>
        <p>
          Idynic provides an AI-powered career management platform that allows users to upload resumes, 
          manage their professional profile, and generate tailored content for job applications.
        </p>
      </section>

      <section>
        <h2>3. User Accounts</h2>
        <p>
          You are responsible for maintaining the security of your account and password. Idynic cannot and will 
          not be liable for any loss or damage from your failure to comply with this security obligation.
        </p>
      </section>

      <section>
        <h2>4. Content and Ownership</h2>
        <p>
          You retain all rights to the personal data and resumes you upload to Idynic. We claim no intellectual 
          property rights over the material you provide to the Service.
        </p>
      </section>

      <section>
        <h2>5. Termination</h2>
        <p>
          You may terminate your account at any time. We reserve the right to suspend or terminate your account 
          if you violate these Terms of Service or engage in illegal or abusive behavior.
        </p>
      </section>
      
      {/* Placeholder for real terms */}
      <section className="bg-muted p-4 rounded-md border text-sm text-muted-foreground">
        <em>Note: This is a placeholder for the full Terms of Service. In a production environment, this should be replaced with a legally binding document drafted by legal counsel.</em>
      </section>
    </div>
  );
}
