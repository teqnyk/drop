import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./sentry.shared";

// The Workers runtime takes this path under OpenNext, not the node one.
Sentry.init(sentryOptions);
