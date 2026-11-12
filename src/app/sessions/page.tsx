import ScreenHeader from "@/components/ScreenHeader";
import Placeholder from "@/components/Placeholder";

export const metadata = { title: "Sessions · PT" };

export default function SessionsPage() {
  return (
    <>
      <ScreenHeader subtitle="Training log" title="Sessions" />
      <Placeholder text="Your completed training sessions will appear here." />
    </>
  );
}
