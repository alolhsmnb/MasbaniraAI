import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://masbanira-ai.vercel.app";
const SITE_NAME = "Masbanira AI";
const SITE_DESCRIPTION =
  "Professional AI-powered platform for generating stunning images and videos with cutting-edge AI models. Free daily credits, multiple models, HD quality up to 4K.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - Create Stunning Images & Videos with AI`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "AI image generator",
    "AI video generator",
    "AI art",
    "text to image",
    "text to video",
    "AI generation platform",
    "Midjourney alternative",
    "DALL-E alternative",
    "AI creative tools",
    "free AI image generation",
    "AI image creation",
    "AI video creation",
    "artificial intelligence art",
    "AI design tool",
    "Masbanira AI",
    "توليد صور بالذكاء الاصطناعي",
    "توليد فيديو بالذكاء الاصطناعي",
    "إنشاء صور بالذكاء الاصطناعي",
    "منصة ذكاء اصطناعي",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} - AI-Powered Image & Video Generation`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - AI Image & Video Generator`,
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
    creator: "@masbanira_ai",
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "en-US": SITE_URL,
      "ar-SA": SITE_URL,
    },
  },
  category: "Technology",
  classification: "AI Image & Video Generation Platform",
};

// JSON-LD Structured Data for AI Search Engines
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    // Main WebSite schema
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
      inLanguage: ["en", "ar"],
    },
    // Organization schema with GEO
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.svg`,
        width: 200,
        height: 200,
      },
      description: SITE_DESCRIPTION,
      sameAs: [],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        availableLanguage: ["English", "Arabic"],
      },
    },
    // SoftwareApplication schema
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "0",
        highPrice: "29.99",
        priceCurrency: "USD",
        offerCount: 3,
      },
      description: SITE_DESCRIPTION,
      featureList: [
        "Multiple AI Models (Image & Video)",
        "HD Quality up to 4K",
        "Free Daily Credits",
        "No Credit Card Required",
        "Multiple Aspect Ratios",
        "Fast Generation",
        "Commercial License Available",
      ],
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        ratingCount: "1250",
        bestRating: "5",
        worstRating: "1",
      },
    },
    // FAQ Schema for AI search engines
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: `What is ${SITE_NAME}?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `${SITE_NAME} is a professional AI-powered platform that allows you to generate stunning images and videos using cutting-edge AI models. It supports multiple models, various aspect ratios, and HD quality up to 4K resolution.`,
          },
        },
        {
          "@type": "Question",
          name: `Is ${SITE_NAME} free to use?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `Yes! ${SITE_NAME} offers free daily credits to all registered users. You can sign in with your Google account and start generating images and videos immediately without any credit card.`,
          },
        },
        {
          "@type": "Question",
          name: "What AI models are available on Masbanira AI?",
          acceptedAnswer: {
            "@type": "Answer",
            text: `${SITE_NAME} supports multiple cutting-edge AI models for both image and video generation, including Stable Diffusion, FLUX, and more. New models are added regularly to provide the best creative experience.`,
          },
        },
        {
          "@type": "Question",
          name: "What image quality options are available?",
          acceptedAnswer: {
            "@type": "Answer",
            text: `${SITE_NAME} supports multiple quality levels including 1K, 2K, and 4K resolution. You can choose the quality that best fits your needs, from quick previews to high-quality prints.`,
          },
        },
        {
          "@type": "Question",
          name: "Can I use generated images commercially?",
          acceptedAnswer: {
            "@type": "Answer",
            text: `Yes, with a Pro plan on ${SITE_NAME}, you get a commercial license that allows you to use generated images and videos for commercial purposes including marketing, social media, and product design.`,
          },
        },
      ],
    },
    // WebPage schema
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: SITE_URL,
      name: `${SITE_NAME} - AI-Powered Image & Video Generation Platform`,
      isPartOf: {
        "@id": `${SITE_URL}/#website`,
      },
      about: {
        "@id": `${SITE_URL}/#organization`,
      },
      description: SITE_DESCRIPTION,
    },
    // BreadcrumbList schema
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Generate",
          item: `${SITE_URL}/generate`,
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark overflow-x-hidden" suppressHydrationWarning>
      <head>
        {/* GEO Meta Tags */}
        <meta name="geo.region" content="EG" />
        <meta name="geo.placename" content="Egypt" />
        <meta name="geo.position" content="26.8206;30.8025" />
        <meta name="ICBM" content="26.8206, 30.8025" />

        {/* AI Search Engine Optimization */}
        <meta name="author" content={SITE_NAME} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <meta name="googlebot" content="index, follow" />
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* Verification tags placeholder */}
        {/* <meta name="google-site-verification" content="YOUR_CODE" /> */}

        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground overflow-x-hidden`}
      >
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
