import { notFound } from "next/navigation";
import "@/styles/landing-theme.css";
import { SiteNav } from "@/features/landing/site-nav";
import { SiteFooter } from "@/features/landing/site-footer";
import { MobileTabBar } from "@/features/landing/mobile-tabbar";
import { MobileBookBar } from "@/features/landing/mobile-book-bar";
import { dmcaAgent } from "@/shared/dmca-agent";

export const metadata = {
  title: "Copyright Policy — Atunṣe",
  description:
    "How to report content on Atunṣe that infringes your copyright, how to respond to a notice, and how to reach our Designated Agent.",
};

// Safe-harbor notice-and-takedown policy (17 U.S.C. 512). Never published
// without a configured Designated Agent (shared/dmca-agent.ts).
export default function CopyrightPage() {
  const agent = dmcaAgent();
  if (!agent) notFound();

  return (
    <div className="landing" id="landing-root">
      <SiteNav />
      <main id="main-content" tabIndex={-1} style={{ maxWidth: 760, margin: "0 auto", padding: "64px 24px" }}>
        <p className="landing-eyebrow">LEGAL</p>
        <h1>Copyright Policy</h1>
        <p className="landing-lede">
          Atunṣe respects the rights of copyright owners and responds to notices of claimed infringement that
          follow the Digital Millennium Copyright Act (17 U.S.C. 512). This page explains how to send a notice,
          how to respond to one, and who receives them.
        </p>

        <h2>Notice of claimed infringement</h2>
        <p>
          If you believe material on this site infringes your copyright, send a written notice to our Designated
          Agent (below). Under 17 U.S.C. 512(c)(3)(A), the notice must include:
        </p>
        <ol>
          <li>The physical or electronic signature of the copyright owner or a person authorized to act on the owner&rsquo;s behalf.</li>
          <li>Identification of the copyrighted work you claim has been infringed.</li>
          <li>Identification of the material you claim is infringing, and where it is on the site (for example, its URL), with enough detail for us to find it.</li>
          <li>Your contact information: address, telephone number and email address.</li>
          <li>A statement that you have a good-faith belief that the use is not authorized by the copyright owner, its agent, or the law.</li>
          <li>A statement that the information in the notice is accurate and, under penalty of perjury, that you are the owner or authorized to act on the owner&rsquo;s behalf.</li>
        </ol>
        <p>
          A notice missing these elements may not be enough for us to act on. When a notice is complete, we remove
          or disable access to the material and may tell the person who posted it.
        </p>

        <h2>Counter-notification</h2>
        <p>
          If material you posted was removed and you believe that was a mistake or that you have the right to use
          it, you may send a counter-notification to the Designated Agent. Under 17 U.S.C. 512(g)(3), it must include:
        </p>
        <ol>
          <li>Your physical or electronic signature.</li>
          <li>Identification of the material that was removed and where it appeared before removal.</li>
          <li>A statement, under penalty of perjury, that you have a good-faith belief the material was removed because of mistake or misidentification.</li>
          <li>Your name, address and telephone number, and a statement that you consent to the jurisdiction of the federal court for your address (or, if outside the United States, any judicial district where we can be found), and that you will accept service of process from the person who sent the original notice.</li>
        </ol>
        <p>
          We forward a valid counter-notification to the person who sent the original notice. Unless that person
          tells us they have filed a court action seeking an order against you, we may restore the material not
          less than 10 and not more than 14 business days after receiving the counter-notification.
        </p>

        <h2>Repeat infringers</h2>
        <p>
          In appropriate circumstances, we terminate the accounts and access of users who are repeat infringers
          (17 U.S.C. 512(i)).
        </p>

        <h2>Misrepresentations</h2>
        <p>
          Under 17 U.S.C. 512(f), anyone who knowingly and materially misrepresents that material is infringing, or
          that it was removed by mistake or misidentification, may be liable for damages, including costs and
          attorneys&rsquo; fees. Consider speaking with a lawyer before sending a notice.
        </p>

        <h2>Designated Agent</h2>
        <address style={{ fontStyle: "normal" }}>
          <p>
            <strong>{agent.name}</strong>
            {agent.addressLines.map((line) => (
              <span key={line}>
                <br />
                {line}
              </span>
            ))}
          </p>
          <p>
            Email: <a href={`mailto:${agent.email}`}>{agent.email}</a>
            {agent.phone && (
              <>
                <br />
                Phone: {agent.phone}
              </>
            )}
            {agent.registrationNumber && (
              <>
                <br />
                U.S. Copyright Office registration number: {agent.registrationNumber}
              </>
            )}
          </p>
        </address>

        <p>
          <small>This page is general information, not legal advice.</small>
        </p>
      </main>
      <SiteFooter />
      <MobileTabBar />
      <MobileBookBar />
    </div>
  );
}
