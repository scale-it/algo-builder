import sys
import yaml

'''
Overwrites scParam values if args is defined and has keys common from scParam
'''
def parse_params(args, scParam):
    
    # decode external parameter and update current values.
    # (if an external paramter is passed)
    try:
        param = yaml.safe_load(args)
        for key, value in param.items():
            scParam[key] = value
        return scParam
    except yaml.YAMLError as exc:
        print(exc)