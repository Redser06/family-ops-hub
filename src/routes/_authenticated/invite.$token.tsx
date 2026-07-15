import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/invite/$token")({
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, setState] = useState<"pending" | "done" | "error">("pending");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { error } = await supabase.rpc("accept_household_invite", { _token: token });
      if (error) {
        setState("error");
        setMsg(error.message);
        return;
      }
      setState("done");
      toast.success("Joined household");
      await queryClient.invalidateQueries({ queryKey: ["membership"] });
      navigate({ to: "/today", replace: true });
    })();
  }, [token, navigate, queryClient]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      {state === "pending" && <p className="font-display italic text-sage">Accepting invite…</p>}
      {state === "error" && (
        <div className="text-center">
          <p className="font-display italic text-clay text-2xl mb-2">Invite failed</p>
          <p className="text-sm text-charcoal/60">{msg}</p>
        </div>
      )}
    </div>
  );
}
