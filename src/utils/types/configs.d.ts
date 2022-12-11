type GeneralConfigType = {
    name: string;
    description: string;
    ownerId: string;
    timezone: string;

    links: {
        supportServer: string;
    };

    devs: string[];
};
