import { ErrorState } from "@/components/error-state";
import { apiError } from "@/lib/coc/errors";

export default function InvalidTagNotFound() {
  return <ErrorState error={apiError("invalidTag", 404)} />;
}
