/**
 * The generic report shell + useReportBuilder: nothing runs until "Generate report" is clicked, editing a filter
 * afterwards never swaps in results for filters that were not generated, and every Generate click re-fires the query.
 */
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { ReportBuilder } from "./ReportBuilder";
import { useReportBuilder } from "@/hooks/useReportBuilder";
import { renderWithProviders } from "@/test/renderWithProviders";

const Harness = ({ fetcher }: { fetcher: (term: string) => Promise<string> }) => {
    const report = useReportBuilder({ term: "alpha" });
    const { data, isLoading } = useQuery({
        queryKey: ["harness", report.appliedFilters?.term ?? "", report.runId],
        queryFn: () => fetcher(report.appliedFilters!.term),
        enabled: report.hasGenerated,
    });
    return (
        <ReportBuilder
            title="Harness report"
            onGenerate={report.generate}
            hasGenerated={report.hasGenerated}
            isLoading={isLoading}
            isEmpty={data === ""}
            filters={
                <input aria-label="term" value={report.filters.term} onChange={(e) => report.setFilter("term", e.target.value)} />
            }
            results={<p data-testid="result">{data}</p>}
        />
    );
};

describe("ReportBuilder", () => {
    it("shows a prompt and fetches nothing until Generate is clicked", async () => {
        const fetcher = vi.fn(async (term: string) => `rows for ${term}`);
        const user = userEvent.setup();
        renderWithProviders(<Harness fetcher={fetcher} />, { withAuth: false });

        expect(screen.getByTestId("report-prompt")).toHaveTextContent("Run this report to see results");
        expect(screen.queryByTestId("report-results")).not.toBeInTheDocument();
        await user.clear(screen.getByLabelText("term"));
        await user.type(screen.getByLabelText("term"), "beta");
        expect(fetcher).not.toHaveBeenCalled();
        expect(screen.getByTestId("report-prompt")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Generate report" }));

        expect(await screen.findByTestId("result")).toHaveTextContent("rows for beta");
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("report-prompt")).not.toBeInTheDocument();
    });

    it("keeps the generated results when a filter changes, and re-fires the query on every Generate", async () => {
        const fetcher = vi.fn(async (term: string) => `rows for ${term}`);
        const user = userEvent.setup();
        renderWithProviders(<Harness fetcher={fetcher} />, { withAuth: false });

        await user.click(screen.getByRole("button", { name: "Generate report" }));
        expect(await screen.findByTestId("result")).toHaveTextContent("rows for alpha");

        // Editing a filter does not fetch and does not replace what is shown.
        await user.clear(screen.getByLabelText("term"));
        await user.type(screen.getByLabelText("term"), "gamma");
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("result")).toHaveTextContent("rows for alpha");

        // Generate again runs with the new filters.
        await user.click(screen.getByRole("button", { name: "Generate again" }));
        await waitFor(() => expect(screen.getByTestId("result")).toHaveTextContent("rows for gamma"));
        expect(fetcher).toHaveBeenLastCalledWith("gamma");

        // ...and with unchanged filters it still re-fires.
        await user.click(screen.getByRole("button", { name: "Generate again" }));
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    });

    it("shows the empty state instead of results when the report has no rows", async () => {
        const user = userEvent.setup();
        renderWithProviders(<Harness fetcher={async () => ""} />, { withAuth: false });

        await user.click(screen.getByRole("button", { name: "Generate report" }));

        expect(await screen.findByTestId("report-empty")).toHaveTextContent("No data matches these filters.");
        expect(screen.queryByTestId("report-results")).not.toBeInTheDocument();
    });
});
