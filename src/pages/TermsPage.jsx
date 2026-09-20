/**
 * TermsPage.jsx - Public terms of service (/terms).
 */
import { LegalLayout } from './legal/LegalLayout'
import { TERMS_LAST_UPDATED } from '../lib/legal'

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated={TERMS_LAST_UPDATED}>
      <p>
        These terms govern your use of the ArcheSpace hosted service at archespace.app and the ArcheSpace
        apps (the "Service"). By creating an account or using the Service, you agree to these terms.
      </p>

      <h2>The service</h2>
      <p>
        ArcheSpace is a private, end-to-end encrypted space to capture and organise your information.
        Content is encrypted on your device; we store only ciphertext.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You are responsible for activity on your account and for keeping your login password secure.</li>
        <li>Your <strong>vault PIN</strong> and <strong>recovery code</strong> protect your encrypted content and are never sent to us. We <strong>cannot</strong> recover them. If you lose both, your content cannot be recovered - only reset.</li>
        <li>You must provide accurate information and be old enough to form a binding contract in your jurisdiction.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>
        You agree not to use the Service to store or distribute unlawful content, to infringe others'
        rights, to disrupt or attack the Service, or to attempt to access data that is not yours. Because
        content is encrypted, you are solely responsible for what you store.
      </p>

      <h2>Open source</h2>
      <p>
        The ArcheSpace software is released under the MIT License, and the source code is publicly
        available. These terms govern the <strong>hosted service we operate</strong>; the license governs
        your use of the source code. The "ArcheSpace" name and logo remain ours.
      </p>

      <h2>Availability</h2>
      <p>
        We aim to keep the Service available and reliable, but it is provided on an "as is" and
        "as available" basis, without guarantees of uptime, and may change or be discontinued.
      </p>

      <h2>Disclaimer of warranties</h2>
      <p>
        To the maximum extent permitted by law, the Service is provided without warranties of any kind,
        express or implied, including fitness for a particular purpose and non-infringement.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, we are not liable for indirect, incidental, or
        consequential damages, or for any <strong>loss of data</strong> - including content that becomes
        unrecoverable because a vault PIN and recovery code were lost. You are responsible for keeping your
        recovery code safe.
      </p>

      <h2>Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless ArcheSpace and its operators from any claims, damages,
        liabilities, and expenses (including reasonable legal fees) arising out of your use of the Service,
        the content you store, or your violation of these terms or applicable law.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time from Settings &rarr; Account. We
        may suspend or terminate accounts that violate these terms or the law.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms from time to time; the "last updated" date above reflects the current
        version. Continued use after changes means you accept them.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India, without regard to conflict-of-law rules. You agree
        to submit to the exclusive jurisdiction of the courts of Mumbai, Maharashtra, India for any dispute
        arising out of or relating to these terms or the Service.
      </p>

      <h2>Miscellaneous</h2>
      <p>
        These terms are the entire agreement between you and us regarding the Service and supersede any
        prior agreements. If any provision is found unenforceable, the remaining provisions stay in effect.
        Our failure to enforce a provision is not a waiver of it. You may not assign these terms without our
        consent; we may assign them in connection with a merger, acquisition, or transfer of the Service.
      </p>

      <h2>Contact</h2>
      <p>Questions about these terms? Contact us at <a href="mailto:help@archespace.app">help@archespace.app</a>.</p>
    </LegalLayout>
  )
}
