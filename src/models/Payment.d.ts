import { Document } from "mongoose";
export interface IPayment extends Document {
    userId: string;
    amount: number;
    status: string;
    createdAt: Date;
}
declare const _default: any;
export default _default;
//# sourceMappingURL=Payment.d.ts.map