import ScreenHeader from "@/components/ScreenHeader";
import Placeholder from "@/components/Placeholder";

export const metadata = { title: "Planner · PT" };

export default function PlannerPage() {
  return (
    <>
      <ScreenHeader subtitle="This week" title="Planner" />
      <Placeholder text="Plan your upcoming workouts here." />
    </>
  );
}
