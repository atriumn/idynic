export default function CookiesPage() {
  return (
    <div className="space-y-6">
      <div className="border-b pb-4 mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Cookie Policy
        </h1>
        <p className="text-muted-foreground">Last updated: December 23, 2025</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          1. What Are Cookies?
        </h2>
        <p>
          Cookies are small text files that are stored on your computer or
          mobile device when you visit a website. They allow the website to
          recognize your device and remember if you have been to the website
          before. Cookies are widely used in order to make websites work, or
          work more efficiently, as well as to provide information to the owners
          of the site.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          2. How We Use Cookies
        </h2>
        <p>
          We use cookies to enhance your browsing experience, serve personalized
          content, and analyze our traffic. Specifically, we use cookies for:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
          <li>
            <strong>Authentication:</strong> To keep you signed in to your
            account.
          </li>
          <li>
            <strong>Security:</strong> To protect your user account and our
            network.
          </li>
          <li>
            <strong>Preferences:</strong> To remember your settings and
            preferences (e.g., theme, language).
          </li>
          <li>
            <strong>Analytics:</strong> To understand how users interact with
            our Service and improve its performance.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          3. Types of Cookies We Use
        </h2>

        <div className="grid gap-4 mt-4">
          <div className="border rounded-lg p-4 bg-muted/20">
            <h3 className="font-semibold mb-2">Essential Cookies</h3>
            <p className="text-sm text-muted-foreground">
              These cookies are strictly necessary to provide you with services
              available through our website and to use some of its features,
              such as access to secure areas.
            </p>
          </div>

          <div className="border rounded-lg p-4 bg-muted/20">
            <h3 className="font-semibold mb-2">Functionality Cookies</h3>
            <p className="text-sm text-muted-foreground">
              These cookies allow our website to remember choices you make when
              you use our website, such as remembering your login details or
              language preference.
            </p>
          </div>

          <div className="border rounded-lg p-4 bg-muted/20">
            <h3 className="font-semibold mb-2">
              Analytics & Performance Cookies
            </h3>
            <p className="text-sm text-muted-foreground">
              These cookies are used to collect information about traffic to our
              website and how users use our website. The information gathered
              does not identify any individual visitor.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          4. Managing Cookies
        </h2>
        <p>
          Most web browsers allow you to control cookies through their settings
          preferences. However, if you limit the ability of websites to set
          cookies, you may worsen your overall user experience, since it will no
          longer be personalized to you. It may also stop you from saving
          customized settings like login information.
        </p>
        <p>
          To find out more about cookies, including how to see what cookies have
          been set and how to manage and delete them, visit{" "}
          <a
            href="https://www.allaboutcookies.org"
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            www.allaboutcookies.org
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          5. Updates to This Policy
        </h2>
        <p>
          We may update this Cookie Policy from time to time. We encourage you
          to periodically review this page for the latest information on our
          privacy practices.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">6. Contact Us</h2>
        <p>
          If you have any questions about our use of cookies, please contact us
          at:
        </p>
        <p className="font-medium">support@idynic.com</p>
      </section>
    </div>
  );
}
