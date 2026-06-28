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

        let geometry : Feature<Polygon | MultiPolygon>;
        let squareMeters: number;
        try{

            geometry = JSON.parse(task.geoJson);
            if (!geometry?.type) {
                throw new Error('Invalid geometric, missing type field');
            }

        squareMeters = area(geometry);


        } catch(error: any) {
            throw new Error(`Error running area calculation: ${error.message}`)
        }

         console.log(`Sending email notification for task ${task.taskId}...`);
          return { area: squareMeters, unit: 'm^2' };
    }
}