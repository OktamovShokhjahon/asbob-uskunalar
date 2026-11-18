import { z } from "zod";
import {
  RENTAL_SERVER_FIELDS,
  bodySchema,
  customerNameSchema,
  customerPhoneSchema,
  daysSchema,
  startDateSchema,
  toolIdSchema,
} from "../../lib/validation";

export const createRentalSchema = bodySchema(
  {
    toolId: toolIdSchema,
    days: daysSchema,
    customerName: customerNameSchema,
    customerPhone: customerPhoneSchema,
    startDate: startDateSchema,
  },
  [...RENTAL_SERVER_FIELDS, "endDate", "userId"],
);

export type CreateRentalInput = z.output<typeof createRentalSchema>;
