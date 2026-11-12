import { redirect } from "next/navigation";

// The home page just sends you to the Planner tab.
export default function Home() {
  redirect("/planner");
}
