import { redirect } from "next/navigation";

// Public self-registration is disabled — accounts are pre-created by the admin.
// Anyone hitting /register is sent to the login page.
export default function RegisterPage() {
  redirect("/login");
}
