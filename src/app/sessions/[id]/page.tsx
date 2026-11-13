import { Suspense } from "react";
import SessionEditor from "@/components/sessions/SessionEditor";

export const metadata = { title: "Edit session · PT" };

// The session id is only known when the page is opened, so it loads inside <Suspense>.
export default function EditSessionPage(props: PageProps<"/sessions/[id]">) {
  return (
    <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
      <EditorForId params={props.params} />
    </Suspense>
  );
}

async function EditorForId({ params }: { params: PageProps<"/sessions/[id]">["params"] }) {
  const { id } = await params;
  return <SessionEditor id={id} />;
}
