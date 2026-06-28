import { PolygonAreaJob } from '../jobs/PolygonAreaJob';
import { Task } from '../models/Task';

const VALID_GEOJSON = JSON.stringify({
    type: 'Feature',
    geometry: {
        type: 'Polygon',
        coordinates: [[
            [-63.624885020050996, -10.311050368263523],
            [-63.624885020050996, -10.367865108370523],
            [-63.61278302732815,  -10.367865108370523],
            [-63.61278302732815,  -10.311050368263523],
            [-63.624885020050996, -10.311050368263523],
        ]],
    },
    properties: {},
});

function makeTask(geoJson: string): Task {
    return { taskId: 'test-id', geoJson } as unknown as Task;
}

describe('PolygonAreaJob', () => {
    let job: PolygonAreaJob;

    beforeEach(() => {
        job = new PolygonAreaJob();
    });

    it('returns area in square meters and correct unit for a valid polygon', async () => {
        const result = await job.run(makeTask(VALID_GEOJSON));

        expect(result.unit).toBe('m^2');
        expect(result.area).toBeGreaterThan(0);
        expect(result.area).toBeCloseTo(8363324, -3);
    });

    it('throws when geoJson is not valid JSON', async () => {
        await expect(job.run(makeTask('not-json'))).rejects.toThrow();
    });

    it('throws when geoJson is missing the type field', async () => {
        const noType = JSON.stringify({ geometry: { coordinates: [] } });
        await expect(job.run(makeTask(noType))).rejects.toThrow();
    });
});
