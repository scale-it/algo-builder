import yaml


def parse_params(args, scParam):
    '''
    Decodes external template parameters and overwrites the default values.
    '''
    try:
        param = yaml.safe_load(args)
        for key, value in param.items():
            scParam[key] = value
        return scParam
    except yaml.YAMLError as exc:
        print("CAN'T LOAD CUSTOM TEMPLATE PARARMETERS")
        raise exc
