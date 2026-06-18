import { Helmet } from "react-helmet-async";

const SITE_URL = "https://offsidepdel.lovable.app";

type SeoProps = {
  title: string;
  description?: string;
  path: string;
  jsonLd?: object | object[];
};

export function Seo({ title, description, path, jsonLd }: SeoProps) {
  const url = `${SITE_URL}${path}`;
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:url" content={url} />
      {description && <meta property="og:description" content={description} />}
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      {ldArray.map((obj, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(obj)}</script>
      ))}
    </Helmet>
  );
}
