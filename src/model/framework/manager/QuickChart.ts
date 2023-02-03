import { AbstractRequestEngine } from '../engine/impl/AbstractRequestEngine.js';
export class QuickChartRequestEngine extends AbstractRequestEngine {
    constructor() {
        super('https://quickchart.io');
    }

    public async getChart(params: Record<string, any>): Promise<any> {
        const response = await this.api.get('/chart', { params });
        return response.data;
    }
    public async generateChartImage(chartOptions: Record<string, any>): Promise<any> {
        // append format=png to the chart options to get a PNG image
        chartOptions.format = 'png';
        const response = await this.api.get('/chart', {
            params: { c: JSON.stringify(chartOptions) },
        });
        return response.data;
    }
    public generateChartURL(params: Record<string, any>): string {
        return `${this.baseUrl}/chart?bkg=%23ffffff&c=${encodeURIComponent(
            JSON.stringify(params)
        )}`;
    }
}
