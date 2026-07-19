// src/components/explorer/ScaleExplorerPanel.jsx

import useTheory from "../../src/hooks/useTheory";

export default function ScaleExplorerPanel() {
  const {
    loading,
    error,
    kernel,
    selection,
    generation,
    rows,
    currentRowIndex,
    selectPlugin,
    selectRoot,
    selectExercise,
    selectMode,
    selectRow,
  } = useTheory();

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (error) {
    return (
      <pre className="p-6 whitespace-pre-wrap text-red-600">
        {error.stack ?? error.message}
      </pre>
    );
  }

  const plugins = kernel.plugins.all();
  const activePlugin = kernel.plugins.get(selection.plugin);
  const exerciseModel = generation?.exerciseModel;

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <h2 className="text-xl font-semibold">Theory Workspace</h2>

      <section className="grid gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Plugin</span>
          <select
            className="rounded border px-3 py-2"
            value={selection.plugin}
            onChange={event => selectPlugin(event.target.value)}
          >
            {plugins.map(plugin => (
              <option key={plugin.id} value={plugin.id}>
                {plugin.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Root</span>
          <select
            className="rounded border px-3 py-2"
            value={selection.root}
            onChange={event => selectRoot(event.target.value)}
          >
            {(activePlugin?.roots ?? []).map(root => (
              <option key={root} value={root}>
                {root}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Exercise</span>
          <select
            className="rounded border px-3 py-2"
            value={selection.exercise}
            onChange={event => selectExercise(event.target.value)}
          >
            {(activePlugin?.exercises ?? []).map(exercise => (
              <option key={exercise} value={exercise}>
                {exercise}
              </option>
            ))}
          </select>
        </label>

        {selection.exercise === "modes" && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Mode</span>
            <select
              className="rounded border px-3 py-2"
              value={selection.mode}
              onChange={event => selectMode(Number(event.target.value))}
            >
              {(activePlugin?.modes ?? []).map((modeName, index) => (
                <option key={modeName} value={index + 1}>
                  {index + 1}. {modeName}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {exerciseModel && (
        <section className="rounded border bg-white p-4 space-y-3">
          <h3 className="text-lg font-semibold">{exerciseModel.title}</h3>

          <div className="flex flex-wrap gap-2">
            {(exerciseModel.metadata?.notes ?? []).map(note => (
              <span
                key={note}
                className="rounded bg-slate-100 px-2 py-1 text-sm"
              >
                {note}
              </span>
            ))}
          </div>

          <div className="overflow-auto rounded border">
            <table className="min-w-full border-collapse">
              <thead className="bg-slate-100">
                <tr>
                  {(exerciseModel.schema?.columns ?? []).map(column => (
                    <th
                      key={column.id}
                      className="border-b px-3 py-2 text-left text-sm font-semibold"
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    onClick={() => selectRow(index)}
                    className={
                      index === currentRowIndex
                        ? "cursor-pointer bg-blue-100"
                        : "cursor-pointer hover:bg-slate-50"
                    }
                  >
                    {(exerciseModel.schema?.columns ?? []).map(column => {
                      const value = column.render
                        ? column.render(row, row[column.id])
                        : row[column.id];

                      return (
                        <td key={column.id} className="border-b px-3 py-2">
                          {Array.isArray(value) ? value.join(" ") : value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {generation?.render?.content && (
        <section className="rounded border bg-white p-4">
          <h3 className="mb-3 text-lg font-semibold">Notation Preview</h3>

          <div
            className="overflow-auto"
            dangerouslySetInnerHTML={{
              __html: generation.render.content,
            }}
          />
        </section>
      )}
    </div>
  );
}