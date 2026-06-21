import { LogOut } from "lucide-react";

// Posts to the sign-out route handler which clears the session cookie.
export default function SignOutButton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className={`flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 ${className}`}
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </form>
  );
}
