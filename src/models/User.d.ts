import { Document } from "mongoose";
export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    createdAt: Date;
}
declare const _default: any;
export default _default;
//# sourceMappingURL=User.d.ts.map