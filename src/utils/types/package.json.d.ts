type packageJsonTypes = {
    name?: string;
    version?: string;
    description?: string;
    type?: string;
    main?: string;
    scripts?: { [key: string]: string };
    repository?: {
        type?: string;
        url?: string;
    };
    author?: string;
    license?: string;
    bugs?: {
        url?: string;
    };
    dependencies?: { [key: string]: string };
    homepage?: string;
    devDependencies?: { [key: string]: string };
};
