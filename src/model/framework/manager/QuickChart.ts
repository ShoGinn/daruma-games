import { AbstractRequestEngine } from '../engine/impl/AbstractRequestEngine.js';

export class QuickChartRequestEngine extends AbstractRequestEngine {
    constructor() {
        super('https://quickchart.io');
    }

    public async getChart(params: Record<string, any>): Promise<any> {
        const response = await this.api.get('/chart', { params });
        return response.data;
    }
}
