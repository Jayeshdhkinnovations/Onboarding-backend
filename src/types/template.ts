import { IFormField } from "../models/Form";

export interface Template {
  id: string;
  name: string;
  category: string;
  fields: IFormField[];
  theme: string;
  isActive: boolean;
}
