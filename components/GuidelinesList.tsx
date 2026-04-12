import React from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';

export default function GuidelinesList() {
  const guidelines = [
    {
      category: "Schizophrenia & Psychosis",
      items: [
        { title: "Practice Guideline for the Treatment of Patients With Schizophrenia, 3rd Ed (2020)", source: "American Psychiatric Association (USA)" },
        { title: "Guidelines for the Pharmacotherapy of Schizophrenia in Adults, 2nd Ed (2017)", source: "Canadian Psychiatric Association (Canada)" },
        { title: "Psychosis and Schizophrenia in Adults – Treatment and management (2014/2015)", source: "NICE (UK)" },
      ]
    },
    {
      category: "Major Depressive Disorder (MDD)",
      items: [
        { title: "CANMAT 2023 Update on Clinical Guidelines for Management of Major Depressive Disorder in Adults", source: "CANMAT (Canada)" },
        { title: "Practice Guideline for the Treatment of Patients With Major Depressive Disorder, 3rd Ed (2010)", source: "American Psychiatric Association (USA)" },
        { title: "Depression in Adults: Recognition and management (2016)", source: "NICE (UK)" },
      ]
    },
    {
      category: "Bipolar Disorder",
      items: [
        { title: "CANMAT and ISBD 2018 guidelines for the management of patients with bipolar disorder", source: "CANMAT/ISBD (Canada/Intl)" },
        { title: "Practice Guideline for the Treatment of Patients With Bipolar Disorder, 2nd Ed (2010)", source: "American Psychiatric Association (USA)" },
        { title: "Bipolar Disorder: Assessment and management (2014/2015)", source: "NICE (UK)" },
      ]
    },
    {
      category: "Anxiety Disorders",
      items: [
        { title: "Canadian Clinical Practice Guidelines for the Management of Anxiety, PTSD and OCD (2014)", source: "Anxiety Disorders Association of Canada" },
        { title: "Practice Guideline for the Treatment of Patients with Panic Disorder, 2nd Ed. (2010)", source: "American Psychiatric Association (USA)" },
        { title: "Generalised Anxiety Disorder and Panic Disorder in Adults: Management (2011)", source: "NICE (UK)" },
      ]
    },
    {
      category: "Antipsychotic Associated Side Effects",
      items: [
        { title: "BAP guidelines on the management of weight gain, metabolic disturbances and cardiovascular risk associated with psychosis and antipsychotic drug treatment", source: "Cooper SJ, et al. J Psychopharmacol 2016" },
        { title: "Summary of Evidence-based Guidelines for CLINICIANS: Treatment of Tardive Syndromes", source: "American Academy of Neurology (2013)" },
        { title: "Acute antipsychotic-induced akathisia revisited", source: "Poyurovsky, M. Br J Psychiatry 2010" }
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-blue-600" />
          Foundational Clinical Guidelines
        </h2>
        <p className="text-slate-600 mt-2">
          The clinical logic, deterministic switching protocols, and AI-assisted recommendations within this application are strictly based on the following peer-reviewed, international clinical practice guidelines.
        </p>
      </div>

      <div className="space-y-8">
        {guidelines.map((section, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-800">{section.category}</h3>
            </div>
            <ul className="divide-y divide-slate-100">
              {section.items.map((item, itemIdx) => (
                <li key={itemIdx} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="text-slate-900 font-medium">{item.title}</p>
                      <p className="text-slate-500 text-sm mt-1">{item.source}</p>
                    </div>
                    <BookOpen className="h-4 w-4 text-slate-300 flex-shrink-0 mt-1" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      
      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800">
        <p>
          <strong>Note:</strong> This application is designed for clinical decision support and should be used in conjunction with professional clinical judgment. Guidelines are updated periodically; always refer to the primary literature for the most current evidence.
        </p>
      </div>
    </div>
  );
}
