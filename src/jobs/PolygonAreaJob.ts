import { Job } from './Job';
import { Task } from '../models/Task';
import area from '@turf/area';
import { Feature, Polygon, MultiPolygon } from 'geojson';

type PolygonAreaFinal = {
    area: number,
    unit: string
}

export class PolygonAreaJob implements Job {
    async run(task: Task): Promise<PolygonAreaFinal> {
		console.log(`Implement Area calculation for ${task.taskId}...`);
		const geometry: Feature<Polygon | MultiPolygon> = JSON.parse(task.geoJson);

		if (!geometry?.type) {
			//dont need catch because of taskRunner catch
			throw new Error('Invalid GeoJSON: missing type field');
		}

		const squareMeters = area(geometry);
		console.log(`Final value area: ${squareMeters} m^2`);
		return { area: squareMeters, unit: 'm^2' };
    }
}