import { RENTAL_SERVER_FIELDS, bodySchema, daysSchema, toolIdSchema } from "../../lib/validation";

export const quoteSchema = bodySchema({ toolId: toolIdSchema, days: daysSchema }, RENTAL_SERVER_FIELDS);
