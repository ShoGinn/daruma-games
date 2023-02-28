// ignore 18046 typings on this file, it's just a mock
import { AxiosStatic } from 'axios';
const mockAxios: AxiosStatic = jest.genMockFromModule('axios');

// this is the key to fix the axios.create() undefined error!
mockAxios.create = jest.fn(() => mockAxios);

export default mockAxios;
