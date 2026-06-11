import { userHasPillars as mongoUserHasPillars } from "./mongodb/store/users";

export async function userHasPillars(userId: number): Promise<boolean> {
  return mongoUserHasPillars(userId);
}
