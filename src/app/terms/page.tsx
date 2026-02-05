import React from "react";
import Link from "next/link";
import { ArrowLeft, Scale, ShieldCheck, Info } from "lucide-react";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#fafafa] py-12 px-8">
      <div className="max-w-3xl mx-auto">
        <Link 
          href="/" 
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-8 md:p-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Service</h1>
            <p className="text-gray-500 mb-10 text-sm italic">Last updated: February 4, 2026</p>

            <section className="space-y-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  1. Acceptance of Terms
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  By accessing or using anoncast.net ("the Service"), you agree to be bound by these Terms of Service. 
                  If you do not agree to these terms, please do not use the Service. anoncast provides a platform 
                  to convert written content from URLs into audio format for personal use and accessibility.
                </p>
              </div>

              <div className="p-6 bg-blue-50/50 rounded-xl border border-blue-100">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-blue-600" />
                  2. Fair Use & Copyright Compliance
                </h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  anoncast operates under the principles of the <strong>Fair Use Doctrine</strong> as established in United States copyright law (17 U.S.C. § 107). 
                  Our service is designed to facilitate <strong>transformative use</strong> and <strong>personal accessibility</strong> of publicly available written content.
                </p>
                
                <div className="space-y-4 text-sm text-gray-700">
                  <div className="flex gap-3">
                    <div className="font-bold text-blue-600">I.</div>
                    <p>
                      <strong>Transformative Nature:</strong> The Service transforms static text into dynamic audio, providing a 
                      functionally different experience from the original medium. This transformation serves purposes of 
                      personal time-shifting and accessibility.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="font-bold text-blue-600">II.</div>
                    <p>
                      <strong>Market Effect:</strong> anoncast explicitly avoids competing with the original market for the 
                      written work. We provide direct links to the original blog posts in every generated episode and 
                      encourage users to support original authors. Furthermore, anoncast only converts content that is 
                      <strong> freely accessible</strong> on the public internet. We do not support or facilitate the 
                      conversion of paywalled content, ensuring we do not impede a creator's ability to earn from their 
                      proprietary work.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="font-bold text-blue-600">III.</div>
                    <p>
                      <strong>Legal Precedent:</strong> Our compliance is informed by rulings such as <em>Authors Guild v. Google, Inc.</em>, 
                      which established that digital transformation for search and indexing can constitute fair use, and the 
                      <em>HathiTrust</em> decision, which affirmed that converting text to formats accessible to individuals with 
                      disabilities is a core fair use benefit.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  3. User Responsibility
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  Users of the Service are responsible for ensuring their use of generated audio complies with their local 
                  laws and regulations. anoncast is intended for personal consumption and research. Users should not use 
                  the Service to circumvent paywalls or redistribute content in a way that violates original creators' rights.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  4. Content Ownership
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  anoncast does not claim ownership of the original text or the resulting audio generated from user-provided URLs. 
                  The rights to the original content remain with the original authors. The audio file is a technological 
                  representation of that text provided for the user's convenience.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  5. Contact
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  If you are a content creator and wish to have your content excluded from our Service, please contact 
                  us at <a href="mailto:nbaronia@gmail.com" className="text-blue-600 hover:underline">nbaronia@gmail.com</a> and 
                  we will honor your request promptly.
                </p>
              </div>
            </section>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-gray-400">
              Made with ❤️, 🤖, and 😎 by{" "}
              <a 
                href="https://www.nbaronia.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors underline decoration-gray-200 underline-offset-4"
              >
                nbaronia
              </a>
            </p>
            <span className="text-xs text-gray-300">
              © 2026 anoncast
            </span>
          </div>
          <p className="text-[10px] text-gray-300 italic text-center max-w-sm">
            This is a generic template and does not constitute legal advice.
          </p>
        </div>
      </div>
    </main>
  );
}
