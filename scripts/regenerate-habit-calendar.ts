import "dotenv/config";
import { regenerateHabitCalendarTasks } from "../src/lib/recurring-events";

async function main() {
  const titleArg = process.argv[2] ?? "Run";
  const fromDate = process.argv[3] ?? "2026-06-29";
  const userIdArg = process.argv[4];

  const { getMongoDb } = await import("../src/lib/mongodb/client");
  const { COLLECTIONS } = await import("../src/lib/mongodb/schemas");

  const db = await getMongoDb();
  const routine = await db.collection(COLLECTIONS.routines).findOne({
    title: { $regex: new RegExp(`^${titleArg}$`, "i") },
    ...(userIdArg ? { tursoUserId: Number(userIdArg) } : {}),
    spawnTaskCards: true,
  });

  if (!routine) {
    console.error(`No calendar habit found matching "${titleArg}"`);
    process.exit(1);
  }

  console.log(
    `Regenerating "${routine.title}" (id ${routine.tursoId}) from ${fromDate} for user ${routine.tursoUserId}…`
  );

  await regenerateHabitCalendarTasks(routine.tursoUserId, routine.tursoId, fromDate);

  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
