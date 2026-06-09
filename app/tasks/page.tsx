import TasksList from "../../src/components/TasksList";
import TopNav from "../../src/components/TopNav";

export default function TasksPage() {
  return (
    <>
      <TopNav />
      <main className="container">
        <h1 className="title">Tasks & chores</h1>
        <p className="subtitle">
          Things that just need to get done — with optional deadlines.
        </p>
        <TasksList groupByPillar />
      </main>
    </>
  );
}
