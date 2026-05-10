import { useEffect } from "react";

interface Props {
  title: string;
  description?: string;
  image?: string;
}

export function MetaTags({ title, description, image }: Props) {
  useEffect(() => {
    const fullTitle = title.includes("Solicitation") ? title : `${title} · Solicitation Intelligence`;
    document.title = fullTitle;

    const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
      let el = document.head.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    if (description) {
      setMeta("description", description);
      setMeta("og:description", description, "property");
    }
    setMeta("og:title", fullTitle, "property");
    if (image) setMeta("og:image", image, "property");

    let canonical = document.head.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.href;
  }, [title, description, image]);

  return null;
}

export default MetaTags;
