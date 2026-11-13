import ScreenHeader from "@/components/ScreenHeader";
import SessionList from "@/components/sessions/SessionList";

export const metadata = { title: "Sessions · PT" };

export default function SessionsPage() {
  return (
    <>
      <ScreenHeader subtitle="Session templates" title="Sessions" />
      <SessionList />
    </>
  );
}
