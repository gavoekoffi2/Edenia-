import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "EDENIA Community",
  description: "Un espace de contenus et d'échanges sur les relations, le mariage, la communication, la famille et la spiritualité du couple.",
  alternates: { canonical: "/communaute" },
};

export default function Page() {
  return (
    <ContentPage
      kicker="Bientôt"
      title="EDENIA Community"
      lead="Un espace de contenus et d'échanges sur les relations, le mariage, la communication, la famille et la spiritualité du couple."
      blocks={[{ paragraphs: ["En attendant, les articles publiés sur notre blog couvrent déjà ces sujets. La communauté ouvrira lorsque nous pourrons la modérer correctement — un espace d'échange mal modéré fait plus de mal que pas d'espace du tout."] }]}
      cta={{ label: "Créer mon profil", href: "/inscription" }}
    />
  );
}
