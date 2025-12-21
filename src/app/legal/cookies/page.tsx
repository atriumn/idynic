export default function CookiesPage() {
  return (
    <div className="space-y-6">
      <h1>Cookie Policy</h1>
      <p className="text-muted-foreground">Last updated: December 21, 2025</p>

      <section>
        <h2>1. What are cookies?</h2>
        <p>
          Cookies are small text files that are used to store small pieces of information. They are stored on your device when the website is loaded on your browser.
        </p>
      </section>

      <section>
        <h2>2. How we use cookies</h2>
        <p>
          We use cookies to make our website function properly, to make it more secure, to provide better user experience, and to understand how the website performs.
        </p>
      </section>

      <section>
        <h2>3. Types of cookies we use</h2>
        <ul className="list-disc pl-6 space-y-2">
            <li><strong>Essential:</strong> Some cookies are essential for you to be able to experience the full functionality of our site. They allow us to maintain user sessions and prevent any security threats.</li>
            <li><strong>Statistics:</strong> These cookies store information like the number of visitors to the website, the number of unique visitors, which pages of the website have been visited, the source of the visit, etc.</li>
            <li><strong>Functional:</strong> These are the cookies that help certain non-essential functionalities on our website. These functionalities include embedding content like videos or sharing content of the website on social media platforms.</li>
        </ul>
      </section>
    </div>
  );
}
